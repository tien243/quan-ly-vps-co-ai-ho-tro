use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::crypto::{decrypt, encrypt};
use crate::db::{self, Group, Snippet};

// ── Sync-safe representations (secrets stored as plaintext inside bundle) ──

#[derive(Serialize, Deserialize)]
pub struct HostSync {
    pub id: String,
    pub group_id: Option<String>,
    pub label: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_type: String,
    pub ssh_key_id: Option<String>,
    pub password_plain: Option<String>,
    pub tags: String,
    pub jump_host_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct KeySync {
    pub id: String,
    pub name: String,
    pub private_key_pem: String,
    pub public_key: Option<String>,
    pub fingerprint: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize)]
pub struct SettingEntry {
    pub key: String,
    pub value: String,
}

#[derive(Serialize, Deserialize)]
pub struct SyncBundle {
    pub version: String,
    pub exported_at: String,
    pub groups: Vec<Group>,
    pub hosts: Vec<HostSync>,
    pub keys: Vec<KeySync>,
    pub snippets: Vec<Snippet>,
    pub settings: Vec<SettingEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct SyncStats {
    pub groups: usize,
    pub hosts: usize,
    pub keys: usize,
    pub snippets: usize,
}

// ── Passphrase-derived key ──

fn derive_sync_key(passphrase: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(passphrase.as_bytes());
    hasher.update(b"termius-clone-sync-v1-salt");
    hasher.finalize().into()
}

fn encrypt_bundle(json: &str, passphrase: &str) -> Result<String, String> {
    let key = derive_sync_key(passphrase);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, json.as_bytes())
        .map_err(|e| e.to_string())?;
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(STANDARD.encode(combined))
}

fn decrypt_bundle(encoded: &str, passphrase: &str) -> Result<String, String> {
    let combined = STANDARD
        .decode(encoded)
        .map_err(|_| "Invalid sync file format".to_string())?;
    if combined.len() < 12 {
        return Err("Sync file too short or corrupted".to_string());
    }
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    let key = derive_sync_key(passphrase);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Wrong passphrase or corrupted sync file".to_string())?;
    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

// ── Export ──

pub fn export_sync(conn: &Connection, passphrase: &str, path: &str) -> Result<(), String> {
    let groups = db::get_groups(conn).map_err(|e| e.to_string())?;

    let raw_hosts = db::get_hosts(conn).map_err(|e| e.to_string())?;
    let mut hosts: Vec<HostSync> = Vec::new();
    for h in raw_hosts {
        let password_plain = match h.password_encrypted {
            Some(ref enc) => Some(decrypt(enc)?),
            None => None,
        };
        hosts.push(HostSync {
            id: h.id,
            group_id: h.group_id,
            label: h.label,
            host: h.host,
            port: h.port,
            username: h.username,
            auth_type: h.auth_type,
            ssh_key_id: h.ssh_key_id,
            password_plain,
            tags: h.tags,
            jump_host_id: h.jump_host_id,
            sort_order: h.sort_order,
            created_at: h.created_at,
        });
    }

    let raw_keys = db::get_keys(conn).map_err(|e| e.to_string())?;
    let mut keys: Vec<KeySync> = Vec::new();
    for k in raw_keys {
        let private_key_pem = decrypt(&k.private_key_encrypted)?;
        keys.push(KeySync {
            id: k.id,
            name: k.name,
            private_key_pem,
            public_key: k.public_key,
            fingerprint: k.fingerprint,
            created_at: k.created_at,
        });
    }

    let snippets = db::get_snippets(conn).map_err(|e| e.to_string())?;

    let setting_keys = ["theme", "terminal_theme", "font_size"];
    let mut settings: Vec<SettingEntry> = Vec::new();
    for k in &setting_keys {
        if let Ok(Some(v)) = db::settings_get(conn, k) {
            settings.push(SettingEntry {
                key: k.to_string(),
                value: v,
            });
        }
    }

    let bundle = SyncBundle {
        version: "1".to_string(),
        exported_at: chrono_now(),
        groups,
        hosts,
        keys,
        snippets,
        settings,
    };

    let json = serde_json::to_string(&bundle).map_err(|e| e.to_string())?;
    let encrypted = encrypt_bundle(&json, passphrase)?;
    std::fs::write(path, encrypted).map_err(|e| format!("Write failed: {e}"))
}

// ── Import ──

pub fn import_sync(conn: &Connection, passphrase: &str, path: &str) -> Result<SyncStats, String> {
    let encoded = std::fs::read_to_string(path).map_err(|e| format!("Read failed: {e}"))?;
    let json = decrypt_bundle(encoded.trim(), passphrase)?;
    let bundle: SyncBundle = serde_json::from_str(&json)
        .map_err(|e| format!("Parse failed: {e}"))?;

    // Groups: INSERT OR REPLACE
    for g in &bundle.groups {
        conn.execute(
            "INSERT OR REPLACE INTO groups (id, parent_id, name, color, icon, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![g.id, g.parent_id, g.name, g.color, g.icon, g.sort_order, g.created_at],
        ).map_err(|e| e.to_string())?;
    }

    // Hosts: re-encrypt passwords then INSERT OR REPLACE
    for h in &bundle.hosts {
        let password_encrypted = match h.password_plain {
            Some(ref pw) if !pw.is_empty() => Some(encrypt(pw)?),
            _ => None,
        };
        conn.execute(
            "INSERT OR REPLACE INTO hosts (id, group_id, label, host, port, username, auth_type, ssh_key_id, password_encrypted, tags, jump_host_id, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
            rusqlite::params![h.id, h.group_id, h.label, h.host, h.port, h.username, h.auth_type, h.ssh_key_id, password_encrypted, h.tags, h.jump_host_id, h.sort_order, h.created_at],
        ).map_err(|e| e.to_string())?;
    }

    // SSH Keys: re-encrypt private keys then INSERT OR REPLACE
    for k in &bundle.keys {
        let private_key_encrypted = encrypt(&k.private_key_pem)?;
        conn.execute(
            "INSERT OR REPLACE INTO ssh_keys (id, name, private_key_encrypted, public_key, fingerprint, created_at) VALUES (?1,?2,?3,?4,?5,?6)",
            rusqlite::params![k.id, k.name, private_key_encrypted, k.public_key, k.fingerprint, k.created_at],
        ).map_err(|e| e.to_string())?;
    }

    // Snippets: INSERT OR REPLACE
    for s in &bundle.snippets {
        conn.execute(
            "INSERT OR REPLACE INTO snippets (id, name, command, description, tags, sort_order, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
            rusqlite::params![s.id, s.name, s.command, s.description, s.tags, s.sort_order, s.created_at],
        ).map_err(|e| e.to_string())?;
    }

    // Settings: INSERT OR REPLACE
    for entry in &bundle.settings {
        db::settings_set(conn, &entry.key, &entry.value).map_err(|e| e.to_string())?;
    }

    Ok(SyncStats {
        groups: bundle.groups.len(),
        hosts: bundle.hosts.len(),
        keys: bundle.keys.len(),
        snippets: bundle.snippets.len(),
    })
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = secs / 86400;
    let secs_in_day = secs % 86400;
    let year = 1970 + days / 365;
    let month = (days % 365) / 30 + 1;
    let day = (days % 365) % 30 + 1;
    let h = secs_in_day / 3600;
    let m = (secs_in_day % 3600) / 60;
    let s = secs_in_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{h:02}:{m:02}:{s:02}Z")
}
