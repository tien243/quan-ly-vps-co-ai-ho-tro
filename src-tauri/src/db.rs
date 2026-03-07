use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Group {
    #[serde(default)]
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub sort_order: i64,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Host {
    #[serde(default)]
    pub id: String,
    pub group_id: Option<String>,
    pub label: String,
    pub host: String,
    pub port: i64,
    pub username: String,
    pub auth_type: String, // "password" | "key"
    pub ssh_key_id: Option<String>,
    pub password_encrypted: Option<String>,
    pub tags: String, // JSON array
    pub jump_host_id: Option<String>,
    pub sort_order: i64,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SshKey {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub private_key_encrypted: String,
    pub public_key: Option<String>,
    pub fingerprint: Option<String>,
    #[serde(default)]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Snippet {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub command: String,
    pub description: Option<String>,
    pub tags: String, // JSON array
    pub sort_order: i64,
    #[serde(default)]
    pub created_at: String,
}

pub fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(".termius-clone").join("db.sqlite")
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            parent_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            color TEXT,
            icon TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS hosts (
            id TEXT PRIMARY KEY,
            group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
            label TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL DEFAULT 22,
            username TEXT NOT NULL DEFAULT 'root',
            auth_type TEXT NOT NULL DEFAULT 'password',
            ssh_key_id TEXT REFERENCES ssh_keys(id) ON DELETE SET NULL,
            password_encrypted TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            jump_host_id TEXT REFERENCES hosts(id) ON DELETE SET NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ssh_keys (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            private_key_encrypted TEXT NOT NULL,
            public_key TEXT,
            fingerprint TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS snippets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            description TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    ")?;

    // Migrations: add columns that may not exist in older DBs
    let _ = conn.execute_batch("ALTER TABLE hosts ADD COLUMN password_encrypted TEXT;");

    Ok(())
}

pub fn open_db() -> Result<Connection> {
    let path = get_db_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    Connection::open(path)
}

// ---------- Groups ----------

pub fn get_groups(conn: &Connection) -> Result<Vec<Group>> {
    let mut stmt = conn.prepare(
        "SELECT id, parent_id, name, color, icon, sort_order, created_at FROM groups ORDER BY sort_order, name"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Group {
            id: row.get(0)?,
            parent_id: row.get(1)?,
            name: row.get(2)?,
            color: row.get(3)?,
            icon: row.get(4)?,
            sort_order: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn create_group(conn: &Connection, group: &Group) -> Result<()> {
    conn.execute(
        "INSERT INTO groups (id, parent_id, name, color, icon, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![group.id, group.parent_id, group.name, group.color, group.icon, group.sort_order],
    )?;
    Ok(())
}

pub fn update_group(conn: &Connection, group: &Group) -> Result<()> {
    conn.execute(
        "UPDATE groups SET parent_id=?1, name=?2, color=?3, icon=?4, sort_order=?5 WHERE id=?6",
        params![group.parent_id, group.name, group.color, group.icon, group.sort_order, group.id],
    )?;
    Ok(())
}

pub fn delete_group(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM groups WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- Hosts ----------

pub fn get_hosts(conn: &Connection) -> Result<Vec<Host>> {
    let mut stmt = conn.prepare(
        "SELECT id, group_id, label, host, port, username, auth_type, ssh_key_id, password_encrypted, tags, jump_host_id, sort_order, created_at FROM hosts ORDER BY sort_order, label"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Host {
            id: row.get(0)?,
            group_id: row.get(1)?,
            label: row.get(2)?,
            host: row.get(3)?,
            port: row.get(4)?,
            username: row.get(5)?,
            auth_type: row.get(6)?,
            ssh_key_id: row.get(7)?,
            password_encrypted: row.get(8)?,
            tags: row.get(9)?,
            jump_host_id: row.get(10)?,
            sort_order: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;
    rows.collect()
}

pub fn get_host(conn: &Connection, id: &str) -> Result<Option<Host>> {
    let mut stmt = conn.prepare(
        "SELECT id, group_id, label, host, port, username, auth_type, ssh_key_id, password_encrypted, tags, jump_host_id, sort_order, created_at FROM hosts WHERE id=?1"
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(Host {
            id: row.get(0)?,
            group_id: row.get(1)?,
            label: row.get(2)?,
            host: row.get(3)?,
            port: row.get(4)?,
            username: row.get(5)?,
            auth_type: row.get(6)?,
            ssh_key_id: row.get(7)?,
            password_encrypted: row.get(8)?,
            tags: row.get(9)?,
            jump_host_id: row.get(10)?,
            sort_order: row.get(11)?,
            created_at: row.get(12)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn create_host(conn: &Connection, host: &Host) -> Result<()> {
    conn.execute(
        "INSERT INTO hosts (id, group_id, label, host, port, username, auth_type, ssh_key_id, password_encrypted, tags, jump_host_id, sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        params![host.id, host.group_id, host.label, host.host, host.port, host.username, host.auth_type, host.ssh_key_id, host.password_encrypted, host.tags, host.jump_host_id, host.sort_order],
    )?;
    Ok(())
}

pub fn update_host(conn: &Connection, host: &Host) -> Result<()> {
    conn.execute(
        "UPDATE hosts SET group_id=?1, label=?2, host=?3, port=?4, username=?5, auth_type=?6, ssh_key_id=?7, password_encrypted=?8, tags=?9, jump_host_id=?10, sort_order=?11 WHERE id=?12",
        params![host.group_id, host.label, host.host, host.port, host.username, host.auth_type, host.ssh_key_id, host.password_encrypted, host.tags, host.jump_host_id, host.sort_order, host.id],
    )?;
    Ok(())
}

pub fn delete_host(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM hosts WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- SSH Keys ----------

pub fn get_keys(conn: &Connection) -> Result<Vec<SshKey>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, private_key_encrypted, public_key, fingerprint, created_at FROM ssh_keys ORDER BY name"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SshKey {
            id: row.get(0)?,
            name: row.get(1)?,
            private_key_encrypted: row.get(2)?,
            public_key: row.get(3)?,
            fingerprint: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn get_key(conn: &Connection, id: &str) -> Result<Option<SshKey>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, private_key_encrypted, public_key, fingerprint, created_at FROM ssh_keys WHERE id=?1"
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(SshKey {
            id: row.get(0)?,
            name: row.get(1)?,
            private_key_encrypted: row.get(2)?,
            public_key: row.get(3)?,
            fingerprint: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    Ok(rows.next().transpose()?)
}

pub fn create_key(conn: &Connection, key: &SshKey) -> Result<()> {
    conn.execute(
        "INSERT INTO ssh_keys (id, name, private_key_encrypted, public_key, fingerprint) VALUES (?1,?2,?3,?4,?5)",
        params![key.id, key.name, key.private_key_encrypted, key.public_key, key.fingerprint],
    )?;
    Ok(())
}

pub fn delete_key(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM ssh_keys WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- Snippets ----------

pub fn get_snippets(conn: &Connection) -> Result<Vec<Snippet>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, command, description, tags, sort_order, created_at FROM snippets ORDER BY sort_order, name"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Snippet {
            id: row.get(0)?,
            name: row.get(1)?,
            command: row.get(2)?,
            description: row.get(3)?,
            tags: row.get(4)?,
            sort_order: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn create_snippet(conn: &Connection, s: &Snippet) -> Result<()> {
    conn.execute(
        "INSERT INTO snippets (id, name, command, description, tags, sort_order) VALUES (?1,?2,?3,?4,?5,?6)",
        params![s.id, s.name, s.command, s.description, s.tags, s.sort_order],
    )?;
    Ok(())
}

pub fn update_snippet(conn: &Connection, s: &Snippet) -> Result<()> {
    conn.execute(
        "UPDATE snippets SET name=?1, command=?2, description=?3, tags=?4, sort_order=?5 WHERE id=?6",
        params![s.name, s.command, s.description, s.tags, s.sort_order, s.id],
    )?;
    Ok(())
}

pub fn delete_snippet(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM snippets WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- Settings ----------

pub fn settings_get(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key=?1")?;
    let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
    Ok(rows.next().transpose()?)
}

pub fn settings_set(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        init_db(&conn).expect("init failed");
        conn
    }

    fn sample_host(id: &str) -> Host {
        Host {
            id: id.to_string(),
            group_id: None,
            label: "Test Server".to_string(),
            host: "192.168.1.1".to_string(),
            port: 22,
            username: "ubuntu".to_string(),
            auth_type: "password".to_string(),
            ssh_key_id: None,
            tags: "[]".to_string(),
            jump_host_id: None,
            sort_order: 0,
            created_at: String::new(),
        }
    }

    fn sample_group(id: &str) -> Group {
        Group {
            id: id.to_string(),
            parent_id: None,
            name: "Production".to_string(),
            color: Some("#00d2ff".to_string()),
            icon: None,
            sort_order: 0,
            created_at: String::new(),
        }
    }

    #[test]
    fn test_init_db_creates_tables() {
        let conn = test_conn();
        // Should be able to query tables
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM hosts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_create_and_get_host() {
        let conn = test_conn();
        let host = sample_host("h1");
        create_host(&conn, &host).expect("create_host failed");

        let fetched = get_host(&conn, "h1").unwrap().expect("host not found");
        assert_eq!(fetched.id, "h1");
        assert_eq!(fetched.label, "Test Server");
        assert_eq!(fetched.host, "192.168.1.1");
        assert_eq!(fetched.port, 22);
        assert_eq!(fetched.username, "ubuntu");
    }

    #[test]
    fn test_get_hosts_returns_all() {
        let conn = test_conn();
        create_host(&conn, &sample_host("h1")).unwrap();
        create_host(&conn, &sample_host("h2")).unwrap();

        let hosts = get_hosts(&conn).unwrap();
        assert_eq!(hosts.len(), 2);
    }

    #[test]
    fn test_update_host() {
        let conn = test_conn();
        create_host(&conn, &sample_host("h1")).unwrap();

        let mut updated = sample_host("h1");
        updated.label = "Updated Server".to_string();
        updated.port = 2222;
        update_host(&conn, &updated).unwrap();

        let fetched = get_host(&conn, "h1").unwrap().unwrap();
        assert_eq!(fetched.label, "Updated Server");
        assert_eq!(fetched.port, 2222);
    }

    #[test]
    fn test_delete_host() {
        let conn = test_conn();
        create_host(&conn, &sample_host("h1")).unwrap();

        delete_host(&conn, "h1").unwrap();

        let result = get_host(&conn, "h1").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_create_and_get_group() {
        let conn = test_conn();
        let group = sample_group("g1");
        create_group(&conn, &group).unwrap();

        let groups = get_groups(&conn).unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].name, "Production");
        assert_eq!(groups[0].color, Some("#00d2ff".to_string()));
    }

    #[test]
    fn test_delete_group() {
        let conn = test_conn();
        create_group(&conn, &sample_group("g1")).unwrap();
        delete_group(&conn, "g1").unwrap();

        let groups = get_groups(&conn).unwrap();
        assert_eq!(groups.len(), 0);
    }

    #[test]
    fn test_create_and_get_snippet() {
        let conn = test_conn();
        let snippet = Snippet {
            id: "s1".to_string(),
            name: "Check disk".to_string(),
            command: "df -h".to_string(),
            description: Some("Show disk usage".to_string()),
            tags: "[]".to_string(),
            sort_order: 0,
            created_at: String::new(),
        };
        create_snippet(&conn, &snippet).unwrap();

        let snippets = get_snippets(&conn).unwrap();
        assert_eq!(snippets.len(), 1);
        assert_eq!(snippets[0].command, "df -h");
    }

    #[test]
    fn test_settings_get_set() {
        let conn = test_conn();

        // Non-existent key returns None
        let val = settings_get(&conn, "theme").unwrap();
        assert!(val.is_none());

        // Set then get
        settings_set(&conn, "theme", r#"{"mode":"dark"}"#).unwrap();
        let val = settings_get(&conn, "theme").unwrap();
        assert_eq!(val, Some(r#"{"mode":"dark"}"#.to_string()));

        // Update existing key
        settings_set(&conn, "theme", r#"{"mode":"light"}"#).unwrap();
        let val = settings_get(&conn, "theme").unwrap();
        assert_eq!(val, Some(r#"{"mode":"light"}"#.to_string()));
    }

    #[test]
    fn test_ssh_key_crud() {
        let conn = test_conn();
        let key = SshKey {
            id: "k1".to_string(),
            name: "My Key".to_string(),
            private_key_encrypted: "encrypted_data".to_string(),
            public_key: None,
            fingerprint: Some("SHA256:ab:cd:ef".to_string()),
            created_at: String::new(),
        };
        create_key(&conn, &key).unwrap();

        let keys = get_keys(&conn).unwrap();
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].name, "My Key");

        let fetched = get_key(&conn, "k1").unwrap().unwrap();
        assert_eq!(fetched.private_key_encrypted, "encrypted_data");

        delete_key(&conn, "k1").unwrap();
        let keys = get_keys(&conn).unwrap();
        assert_eq!(keys.len(), 0);
    }

    #[test]
    fn test_host_with_group() {
        let conn = test_conn();
        let group = sample_group("g1");
        create_group(&conn, &group).unwrap();

        let mut host = sample_host("h1");
        host.group_id = Some("g1".to_string());
        create_host(&conn, &host).unwrap();

        let fetched = get_host(&conn, "h1").unwrap().unwrap();
        assert_eq!(fetched.group_id, Some("g1".to_string()));
    }
}
