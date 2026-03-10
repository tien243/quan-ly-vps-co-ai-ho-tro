mod commands;
mod crypto;
mod db;
mod google_sync;
mod sftp;
mod ssh;
mod sync;

use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::Mutex as AsyncMutex;

use crate::sftp::SftpMap;
use crate::ssh::SessionMap;

pub struct AppState {
    pub conn: Mutex<Connection>,
    pub sessions: SessionMap,
    pub sftp_sessions: SftpMap,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = db::open_db().expect("Failed to open database");
    db::init_db(&conn).expect("Failed to initialize database");

    let state = AppState {
        conn: Mutex::new(conn),
        sessions: Arc::new(AsyncMutex::new(HashMap::new())),
        sftp_sessions: Arc::new(AsyncMutex::new(HashMap::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Groups
            commands::db_get_groups,
            commands::db_create_group,
            commands::db_update_group,
            commands::db_delete_group,
            // Hosts
            commands::db_get_hosts,
            commands::db_create_host,
            commands::db_update_host,
            commands::db_delete_host,
            // SSH Keys
            commands::db_get_keys,
            commands::db_create_key,
            commands::db_delete_key,
            // Snippets
            commands::db_get_snippets,
            commands::db_create_snippet,
            commands::db_update_snippet,
            commands::db_delete_snippet,
            // Settings
            commands::settings_get,
            commands::settings_set,
            // SSH
            commands::ssh_connect_cmd,
            commands::ssh_write_cmd,
            commands::ssh_resize_cmd,
            commands::ssh_disconnect_cmd,
            // SFTP
            commands::sftp_open_cmd,
            commands::sftp_list_cmd,
            commands::sftp_download_cmd,
            commands::sftp_upload_cmd,
            commands::sftp_delete_cmd,
            commands::sftp_rename_cmd,
            commands::sftp_mkdir_cmd,
            // Sync (file-based)
            commands::sync_export_cmd,
            commands::sync_import_cmd,
            // Google Drive Sync
            commands::google_auth_cmd,
            commands::google_status_cmd,
            commands::google_disconnect_cmd,
            commands::google_upload_cmd,
            commands::google_download_cmd,
            // Auth (Google Sign-In)
            commands::auth_check_session_cmd,
            commands::auth_login_cmd,
            commands::auth_logout_cmd,
            commands::auth_get_client_id_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
