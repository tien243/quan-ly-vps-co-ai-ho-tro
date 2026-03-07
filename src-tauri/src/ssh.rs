use async_trait::async_trait;
use russh::client::{self, Handler, Msg, Session};
use russh::*;
use russh_keys::decode_secret_key;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct SshSession {
    pub session_id: String,
    pub host_id: String,
    pub host_label: String,
    pub channel: russh::client::Handle<ClientHandler>,
    pub shell_channel_id: Option<ChannelId>,
}

#[derive(Clone)]
pub struct ClientHandler {
    pub app: AppHandle,
    pub session_id: String,
}

#[async_trait]
impl Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<bool, Self::Error> {
        // Accept all host keys for now (MVP)
        Ok(true)
    }

    async fn data(
        &mut self,
        _channel: ChannelId,
        data: &[u8],
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        let payload = String::from_utf8_lossy(data).to_string();
        let event_name = format!("ssh://data/{}", self.session_id);
        self.app.emit(&event_name, payload).ok();
        Ok(())
    }

    async fn extended_data(
        &mut self,
        _channel: ChannelId,
        _ext: u32,
        data: &[u8],
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        let payload = String::from_utf8_lossy(data).to_string();
        let event_name = format!("ssh://data/{}", self.session_id);
        self.app.emit(&event_name, payload).ok();
        Ok(())
    }

    async fn channel_close(
        &mut self,
        _channel: ChannelId,
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        let event_name = format!("ssh://exit/{}", self.session_id);
        self.app.emit(&event_name, ()).ok();
        Ok(())
    }
}

pub type SessionMap = Arc<Mutex<HashMap<String, Arc<Mutex<SshSessionState>>>>>;

pub struct SshSessionState {
    pub channel: client::Handle<ClientHandler>,
    pub shell_channel: Option<Channel<Msg>>,
    pub host_label: String,
}

#[derive(Clone, serde::Serialize)]
pub struct ConnectResult {
    pub session_id: String,
    pub host_label: String,
}

pub async fn ssh_connect(
    app: AppHandle,
    sessions: SessionMap,
    _host_id: String,
    host_label: String,
    hostname: String,
    port: u16,
    username: String,
    auth_type: String,
    password: Option<String>,
    private_key_pem: Option<String>,
) -> Result<ConnectResult, String> {
    let session_id = Uuid::new_v4().to_string();

    let config = Arc::new(client::Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(3600)),
        ..<_>::default()
    });

    let handler = ClientHandler {
        app: app.clone(),
        session_id: session_id.clone(),
    };

    let addr = format!("{}:{}", hostname, port);
    let mut handle = client::connect(config, addr, handler)
        .await
        .map_err(|e| format!("Connection failed: {e}"))?;

    // Authenticate
    let authed = if auth_type == "key" {
        let pem = private_key_pem.ok_or("No private key provided")?;
        let key_pair = decode_secret_key(&pem, None)
            .map_err(|e| format!("Invalid SSH key: {e}"))?;
        handle
            .authenticate_publickey(&username, Arc::new(key_pair))
            .await
            .map_err(|e| format!("Key auth failed: {e}"))?
    } else {
        let pw = password.ok_or("No password provided")?;
        handle
            .authenticate_password(&username, &pw)
            .await
            .map_err(|e| format!("Password auth failed: {e}"))?
    };

    if !authed {
        return Err("Authentication failed".to_string());
    }

    // Open shell channel
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Channel open failed: {e}"))?;

    channel
        .request_pty(false, "xterm-256color", 220, 50, 0, 0, &[])
        .await
        .map_err(|e| format!("PTY request failed: {e}"))?;

    channel
        .request_shell(false)
        .await
        .map_err(|e| format!("Shell request failed: {e}"))?;

    let state = SshSessionState {
        channel: handle,
        shell_channel: Some(channel),
        host_label: host_label.clone(),
    };

    sessions
        .lock()
        .await
        .insert(session_id.clone(), Arc::new(Mutex::new(state)));

    Ok(ConnectResult {
        session_id,
        host_label,
    })
}

pub async fn ssh_write(sessions: SessionMap, session_id: &str, data: &str) -> Result<(), String> {
    let map = sessions.lock().await;
    let state = map
        .get(session_id)
        .ok_or("Session not found")?
        .clone();
    drop(map);

    let mut s = state.lock().await;
    if let Some(ch) = s.shell_channel.as_mut() {
        ch.data(data.as_bytes())
            .await
            .map_err(|e| format!("Write failed: {e}"))?;
    }
    Ok(())
}

pub async fn ssh_resize(
    sessions: SessionMap,
    session_id: &str,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    let map = sessions.lock().await;
    let state = map
        .get(session_id)
        .ok_or("Session not found")?
        .clone();
    drop(map);

    let mut s = state.lock().await;
    if let Some(ch) = s.shell_channel.as_mut() {
        ch.window_change(cols, rows, 0, 0)
            .await
            .map_err(|e| format!("Resize failed: {e}"))?;
    }
    Ok(())
}

pub async fn ssh_disconnect(sessions: SessionMap, session_id: &str) -> Result<(), String> {
    let mut map = sessions.lock().await;
    if let Some(state) = map.remove(session_id) {
        let mut s = state.lock().await;
        if let Some(ch) = s.shell_channel.take() {
            ch.close().await.ok();
        }
        s.channel
            .disconnect(Disconnect::ByApplication, "User disconnected", "en")
            .await
            .ok();
    }
    Ok(())
}
