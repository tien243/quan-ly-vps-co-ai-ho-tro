use russh::client::Msg;
use russh::Channel;
use russh_sftp::client::SftpSession;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::ssh::SessionMap;

pub type SftpMap = Arc<Mutex<HashMap<String, Arc<Mutex<SftpSession>>>>>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: String,
    pub kind: String,
    pub permissions: String,
}

pub async fn sftp_open(
    sessions: SessionMap,
    sftp_sessions: SftpMap,
    session_id: &str,
) -> Result<(), String> {
    let map = sessions.lock().await;
    let state_arc = map
        .get(session_id)
        .ok_or("SSH session not found")?
        .clone();
    drop(map);

    let mut state = state_arc.lock().await;

    let sftp_channel: Channel<Msg> = state
        .channel
        .channel_open_session()
        .await
        .map_err(|e| format!("SFTP channel open failed: {e}"))?;

    sftp_channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("SFTP subsystem request failed: {e}"))?;

    let sftp = SftpSession::new(sftp_channel.into_stream())
        .await
        .map_err(|e| format!("SFTP session init failed: {e}"))?;

    sftp_sessions
        .lock()
        .await
        .insert(session_id.to_string(), Arc::new(Mutex::new(sftp)));

    Ok(())
}

pub async fn sftp_list(
    sftp_sessions: SftpMap,
    session_id: &str,
    path: &str,
) -> Result<Vec<FileEntry>, String> {
    let map = sftp_sessions.lock().await;
    let sftp_arc = map
        .get(session_id)
        .ok_or("SFTP session not found")?
        .clone();
    drop(map);

    let sftp = sftp_arc.lock().await;
    let read_dir = sftp
        .read_dir(path)
        .await
        .map_err(|e| format!("List dir failed: {e}"))?;

    let mut result: Vec<FileEntry> = read_dir
        .into_iter()
        .filter(|e| e.file_name() != "." && e.file_name() != "..")
        .map(|e| {
            let metadata = e.metadata();
            let file_type = e.file_type();
            let kind = if file_type.is_dir() {
                "dir"
            } else if file_type.is_symlink() {
                "symlink"
            } else {
                "file"
            };
            let size = metadata.size.unwrap_or(0);
            let modified = metadata
                .mtime
                .map(|t| format_timestamp(t as u64))
                .unwrap_or_default();
            let permissions = metadata
                .permissions
                .map(|p| format!("{:o}", p))
                .unwrap_or_default();
            let name = e.file_name().to_string();
            let entry_path = if path.ends_with('/') {
                format!("{}{}", path, name)
            } else {
                format!("{}/{}", path, name)
            };
            FileEntry {
                name,
                path: entry_path,
                size,
                modified,
                kind: kind.to_string(),
                permissions,
            }
        })
        .collect();

    result.sort_by(|a, b| {
        if a.kind == "dir" && b.kind != "dir" {
            std::cmp::Ordering::Less
        } else if a.kind != "dir" && b.kind == "dir" {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(result)
}

fn format_timestamp(secs: u64) -> String {
    let days = secs / 86400;
    let secs_in_day = secs % 86400;
    let years = 1970 + days / 365;
    let month_days = (days % 365) / 30;
    let day_of_month = (days % 365) % 30 + 1;
    let hours = secs_in_day / 3600;
    let minutes = (secs_in_day % 3600) / 60;
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}",
        years,
        month_days + 1,
        day_of_month,
        hours,
        minutes
    )
}

pub async fn sftp_download_bytes(
    sftp_sessions: SftpMap,
    session_id: &str,
    remote_path: &str,
) -> Result<Vec<u8>, String> {
    let map = sftp_sessions.lock().await;
    let sftp_arc = map
        .get(session_id)
        .ok_or("SFTP session not found")?
        .clone();
    drop(map);

    let sftp = sftp_arc.lock().await;
    let mut file = sftp
        .open(remote_path)
        .await
        .map_err(|e| format!("Open file failed: {e}"))?;

    use tokio::io::AsyncReadExt;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)
        .await
        .map_err(|e| format!("Read file failed: {e}"))?;

    Ok(buf)
}

pub async fn sftp_upload_bytes(
    sftp_sessions: SftpMap,
    session_id: &str,
    remote_path: &str,
    data: Vec<u8>,
) -> Result<(), String> {
    let map = sftp_sessions.lock().await;
    let sftp_arc = map
        .get(session_id)
        .ok_or("SFTP session not found")?
        .clone();
    drop(map);

    let sftp = sftp_arc.lock().await;
    let mut file = sftp
        .create(remote_path)
        .await
        .map_err(|e| format!("Create file failed: {e}"))?;

    use tokio::io::AsyncWriteExt;
    file.write_all(&data)
        .await
        .map_err(|e| format!("Write file failed: {e}"))?;

    Ok(())
}

pub async fn sftp_delete(
    sftp_sessions: SftpMap,
    session_id: &str,
    path: &str,
    is_dir: bool,
) -> Result<(), String> {
    let map = sftp_sessions.lock().await;
    let sftp_arc = map
        .get(session_id)
        .ok_or("SFTP session not found")?
        .clone();
    drop(map);

    let sftp = sftp_arc.lock().await;
    if is_dir {
        sftp.remove_dir(path)
            .await
            .map_err(|e| format!("Remove dir failed: {e}"))?;
    } else {
        sftp.remove_file(path)
            .await
            .map_err(|e| format!("Remove file failed: {e}"))?;
    }
    Ok(())
}

pub async fn sftp_rename(
    sftp_sessions: SftpMap,
    session_id: &str,
    from: &str,
    to: &str,
) -> Result<(), String> {
    let map = sftp_sessions.lock().await;
    let sftp_arc = map
        .get(session_id)
        .ok_or("SFTP session not found")?
        .clone();
    drop(map);

    let sftp = sftp_arc.lock().await;
    sftp.rename(from, to)
        .await
        .map_err(|e| format!("Rename failed: {e}"))?;
    Ok(())
}

pub async fn sftp_mkdir(
    sftp_sessions: SftpMap,
    session_id: &str,
    path: &str,
) -> Result<(), String> {
    let map = sftp_sessions.lock().await;
    let sftp_arc = map
        .get(session_id)
        .ok_or("SFTP session not found")?
        .clone();
    drop(map);

    let sftp = sftp_arc.lock().await;
    sftp.create_dir(path)
        .await
        .map_err(|e| format!("Mkdir failed: {e}"))?;
    Ok(())
}
