use tauri::State;
use uuid::Uuid;

use crate::crypto::{decrypt, encrypt, fingerprint_from_pem};
use crate::sync::{export_sync, import_sync, SyncStats};
use crate::gist_sync;
use crate::db::{self, Group, Host, Snippet, SshKey};
use crate::sftp::{
    sftp_delete, sftp_download_bytes, sftp_list, sftp_mkdir, sftp_open, sftp_rename,
    sftp_upload_bytes, FileEntry, SftpMap,
};
use crate::ssh::{ssh_connect, ssh_disconnect, ssh_resize, ssh_write, ConnectResult};
use crate::AppState;

fn new_id() -> String {
    Uuid::new_v4().to_string()
}

fn db_err(e: impl std::fmt::Display) -> String {
    format!("DB error: {e}")
}

// ===== Groups =====

#[tauri::command]
pub fn db_get_groups(state: State<'_, AppState>) -> Result<Vec<Group>, String> {
    let conn = state.conn.lock().unwrap();
    db::get_groups(&conn).map_err(db_err)
}

#[tauri::command]
pub fn db_create_group(state: State<'_, AppState>, mut group: Group) -> Result<Group, String> {
    group.id = new_id();
    let conn = state.conn.lock().unwrap();
    db::create_group(&conn, &group).map_err(db_err)?;
    Ok(group)
}

#[tauri::command]
pub fn db_update_group(state: State<'_, AppState>, group: Group) -> Result<Group, String> {
    let conn = state.conn.lock().unwrap();
    db::update_group(&conn, &group).map_err(db_err)?;
    Ok(group)
}

#[tauri::command]
pub fn db_delete_group(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::delete_group(&conn, &id).map_err(db_err)
}

// ===== Hosts =====

#[tauri::command]
pub fn db_get_hosts(state: State<'_, AppState>) -> Result<Vec<Host>, String> {
    let conn = state.conn.lock().unwrap();
    db::get_hosts(&conn).map_err(db_err)
}

#[tauri::command]
pub fn db_create_host(state: State<'_, AppState>, mut host: Host, password: Option<String>) -> Result<Host, String> {
    host.id = new_id();
    if let Some(ref pw) = password {
        if !pw.is_empty() {
            host.password_encrypted = Some(encrypt(pw)?);
        }
    }
    let conn = state.conn.lock().unwrap();
    db::create_host(&conn, &host).map_err(db_err)?;
    host.password_encrypted = None; // never expose
    Ok(host)
}

#[tauri::command]
pub fn db_update_host(state: State<'_, AppState>, mut host: Host, password: Option<String>) -> Result<Host, String> {
    if let Some(ref pw) = password {
        if !pw.is_empty() {
            host.password_encrypted = Some(encrypt(pw)?);
        } else {
            // empty string means clear the saved password
            host.password_encrypted = None;
        }
    }
    // if password is None, preserve whatever was already in the DB
    let conn = state.conn.lock().unwrap();
    if password.is_none() {
        // re-fetch existing to preserve password_encrypted
        if let Ok(Some(existing)) = db::get_host(&conn, &host.id) {
            host.password_encrypted = existing.password_encrypted;
        }
    }
    db::update_host(&conn, &host).map_err(db_err)?;
    host.password_encrypted = None;
    Ok(host)
}

#[tauri::command]
pub fn db_delete_host(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::delete_host(&conn, &id).map_err(db_err)
}

// ===== SSH Keys =====

#[tauri::command]
pub fn db_get_keys(state: State<'_, AppState>) -> Result<Vec<SshKey>, String> {
    let conn = state.conn.lock().unwrap();
    let mut keys = db::get_keys(&conn).map_err(db_err)?;
    // Never expose private key
    for k in &mut keys {
        k.private_key_encrypted = "[encrypted]".to_string();
    }
    Ok(keys)
}

#[tauri::command]
pub fn db_create_key(
    state: State<'_, AppState>,
    name: String,
    private_key_pem: String,
) -> Result<SshKey, String> {
    let encrypted = encrypt(&private_key_pem)?;
    let fingerprint = fingerprint_from_pem(&private_key_pem);
    let key = SshKey {
        id: new_id(),
        name,
        private_key_encrypted: encrypted,
        public_key: None,
        fingerprint: Some(fingerprint),
        created_at: String::new(),
    };
    let conn = state.conn.lock().unwrap();
    db::create_key(&conn, &key).map_err(db_err)?;
    let mut safe = key.clone();
    safe.private_key_encrypted = "[encrypted]".to_string();
    Ok(safe)
}

#[tauri::command]
pub fn db_delete_key(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::delete_key(&conn, &id).map_err(db_err)
}

// ===== Snippets =====

#[tauri::command]
pub fn db_get_snippets(state: State<'_, AppState>) -> Result<Vec<Snippet>, String> {
    let conn = state.conn.lock().unwrap();
    db::get_snippets(&conn).map_err(db_err)
}

#[tauri::command]
pub fn db_create_snippet(state: State<'_, AppState>, mut snippet: Snippet) -> Result<Snippet, String> {
    snippet.id = new_id();
    let conn = state.conn.lock().unwrap();
    db::create_snippet(&conn, &snippet).map_err(db_err)?;
    Ok(snippet)
}

#[tauri::command]
pub fn db_update_snippet(state: State<'_, AppState>, snippet: Snippet) -> Result<Snippet, String> {
    let conn = state.conn.lock().unwrap();
    db::update_snippet(&conn, &snippet).map_err(db_err)?;
    Ok(snippet)
}

#[tauri::command]
pub fn db_delete_snippet(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::delete_snippet(&conn, &id).map_err(db_err)
}

// ===== Settings =====

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.conn.lock().unwrap();
    db::settings_get(&conn, &key).map_err(db_err)
}

#[tauri::command]
pub fn settings_set(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    db::settings_set(&conn, &key, &value).map_err(db_err)
}

// ===== SSH =====

#[tauri::command]
pub async fn ssh_connect_cmd(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    host_id: String,
    password: Option<String>,
) -> Result<ConnectResult, String> {
    let (host, private_key_pem, resolved_password) = {
        let conn = state.conn.lock().unwrap();
        let host = db::get_host(&conn, &host_id)
            .map_err(db_err)?
            .ok_or("Host not found")?;
        let pem = if host.auth_type == "key" {
            if let Some(key_id) = &host.ssh_key_id {
                let key = db::get_key(&conn, key_id)
                    .map_err(db_err)?
                    .ok_or("SSH key not found")?;
                Some(decrypt(&key.private_key_encrypted)?)
            } else {
                None
            }
        } else {
            None
        };
        // Use stored password if caller didn't provide one
        let resolved_pw = if password.is_some() {
            password.clone()
        } else if let Some(ref enc) = host.password_encrypted {
            Some(decrypt(enc)?)
        } else {
            None
        };
        (host, pem, resolved_pw)
    };

    ssh_connect(
        app,
        state.sessions.clone(),
        host_id,
        host.label.clone(),
        host.host.clone(),
        host.port as u16,
        host.username.clone(),
        host.auth_type.clone(),
        resolved_password,
        private_key_pem,
    )
    .await
}

#[tauri::command]
pub async fn ssh_write_cmd(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    ssh_write(state.sessions.clone(), &session_id, &data).await
}

#[tauri::command]
pub async fn ssh_resize_cmd(
    state: State<'_, AppState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    ssh_resize(state.sessions.clone(), &session_id, cols, rows).await
}

#[tauri::command]
pub async fn ssh_disconnect_cmd(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    ssh_disconnect(state.sessions.clone(), &session_id).await
}

// ===== SFTP =====

#[tauri::command]
pub async fn sftp_open_cmd(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    sftp_open(
        state.sessions.clone(),
        state.sftp_sessions.clone(),
        &session_id,
    )
    .await
}

#[tauri::command]
pub async fn sftp_list_cmd(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    sftp_list(state.sftp_sessions.clone(), &session_id, &path).await
}

#[tauri::command]
pub async fn sftp_download_cmd(
    state: State<'_, AppState>,
    session_id: String,
    remote_path: String,
) -> Result<Vec<u8>, String> {
    sftp_download_bytes(state.sftp_sessions.clone(), &session_id, &remote_path).await
}

#[tauri::command]
pub async fn sftp_upload_cmd(
    state: State<'_, AppState>,
    session_id: String,
    remote_path: String,
    data: Vec<u8>,
) -> Result<(), String> {
    sftp_upload_bytes(state.sftp_sessions.clone(), &session_id, &remote_path, data).await
}

#[tauri::command]
pub async fn sftp_delete_cmd(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    sftp_delete(state.sftp_sessions.clone(), &session_id, &path, is_dir).await
}

#[tauri::command]
pub async fn sftp_rename_cmd(
    state: State<'_, AppState>,
    session_id: String,
    from: String,
    to: String,
) -> Result<(), String> {
    sftp_rename(state.sftp_sessions.clone(), &session_id, &from, &to).await
}

#[tauri::command]
pub async fn sftp_mkdir_cmd(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    sftp_mkdir(state.sftp_sessions.clone(), &session_id, &path).await
}

// ===== Sync =====

#[tauri::command]
pub fn sync_export_cmd(
    state: State<'_, AppState>,
    path: String,
    passphrase: String,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    export_sync(&conn, &passphrase, &path)
}

#[tauri::command]
pub fn sync_import_cmd(
    state: State<'_, AppState>,
    path: String,
    passphrase: String,
) -> Result<SyncStats, String> {
    let conn = state.conn.lock().unwrap();
    import_sync(&conn, &passphrase, &path)
}

// ===== GitHub Gist Sync =====

fn gist_settings(conn: &std::sync::MutexGuard<'_, rusqlite::Connection>) -> (String, String) {
    let get = |k: &str| db::settings_get(conn, k).ok().flatten().unwrap_or_default();
    (get("gist_token"), get("gist_id"))
}

/// Validate a GitHub PAT and save it. Returns the GitHub username.
#[tauri::command]
pub async fn gist_connect_cmd(
    state: State<'_, AppState>,
    token: String,
) -> Result<String, String> {
    if token.trim().is_empty() {
        return Err("Token không được để trống.".to_string());
    }
    // Async validate — no mutex held
    let username = gist_sync::validate_token(&token).await?;

    let conn = state.conn.lock().unwrap();
    db::settings_set(&conn, "gist_token", &token).map_err(|e| e.to_string())?;
    db::settings_set(&conn, "gist_username", &username).map_err(|e| e.to_string())?;
    Ok(username)
}

/// Returns the stored GitHub username, or null if not connected.
#[tauri::command]
pub fn gist_status_cmd(state: State<'_, AppState>) -> Option<String> {
    let conn = state.conn.lock().unwrap();
    db::settings_get(&conn, "gist_username").ok().flatten().filter(|v| !v.is_empty())
}

/// Clear all stored Gist credentials.
#[tauri::command]
pub fn gist_disconnect_cmd(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    for key in &["gist_token", "gist_id", "gist_username"] {
        let _ = conn.execute("DELETE FROM app_settings WHERE key=?1", [key]);
    }
    Ok(())
}

/// Export, encrypt, and upload to GitHub Gist.
#[tauri::command]
pub async fn gist_upload_cmd(
    state: State<'_, AppState>,
    passphrase: String,
) -> Result<(), String> {
    // 1. Export + read settings (sync, short lock)
    let (token, gist_id, data) = {
        let conn = state.conn.lock().unwrap();
        let (token, gist_id) = gist_settings(&conn);
        if token.is_empty() {
            return Err("Chưa kết nối GitHub. Vui lòng nhập Personal Access Token trước.".to_string());
        }
        let tmp = std::env::temp_dir().join("termius-gist-up.tcsync");
        export_sync(&conn, &passphrase, tmp.to_str().unwrap())?;
        let data = std::fs::read(&tmp).map_err(|e| format!("Read temp: {e}"))?;
        let _ = std::fs::remove_file(&tmp);
        let id = if gist_id.is_empty() { None } else { Some(gist_id) };
        (token, id, data)
    }; // conn dropped

    // 2. Async upload (no mutex held)
    let new_id = gist_sync::upload_gist(&token, gist_id.as_deref(), data).await?;

    // 3. Save Gist ID
    let conn = state.conn.lock().unwrap();
    db::settings_set(&conn, "gist_id", &new_id).map_err(|e| e.to_string())?;
    Ok(())
}

/// Download and decrypt from GitHub Gist, merge into local DB.
#[tauri::command]
pub async fn gist_download_cmd(
    state: State<'_, AppState>,
    passphrase: String,
) -> Result<SyncStats, String> {
    // 1. Read settings (sync, short lock)
    let (token, gist_id) = {
        let conn = state.conn.lock().unwrap();
        let (token, gist_id) = gist_settings(&conn);
        if token.is_empty() {
            return Err("Chưa kết nối GitHub.".to_string());
        }
        if gist_id.is_empty() {
            return Err("Chưa có dữ liệu sync. Vui lòng upload từ thiết bị khác trước.".to_string());
        }
        (token, gist_id)
    }; // conn dropped

    // 2. Async download (no mutex held)
    let data = gist_sync::download_gist(&token, &gist_id).await?;

    // 3. Import (sync, short lock)
    let tmp = std::env::temp_dir().join("termius-gist-down.tcsync");
    std::fs::write(&tmp, &data).map_err(|e| format!("Write temp: {e}"))?;
    let stats = {
        let conn = state.conn.lock().unwrap();
        let s = import_sync(&conn, &passphrase, tmp.to_str().unwrap());
        let _ = std::fs::remove_file(&tmp);
        s
    };
    stats
}
