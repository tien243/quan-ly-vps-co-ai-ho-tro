/// Google Drive sync module.
///
/// Design constraint: `std::sync::MutexGuard<Connection>` is `!Send`, so it must
/// **never be held across an `.await` point** in an async Tauri command.
/// All functions here therefore take plain `String` / `Vec<u8>` arguments, not
/// `&Connection`. The callers in `commands.rs` do:
///   1. lock mutex → read/export → unlock
///   2. call async functions here (no mutex held)
///   3. lock mutex → write results → unlock
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::Rng;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

// ── Constants ──────────────────────────────────────────────────────────────

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT: &str = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT: &str = "https://www.googleapis.com/oauth2/v3/userinfo";
const DRIVE_FILES_ENDPOINT: &str = "https://www.googleapis.com/drive/v3/files";

const SYNC_FILENAME: &str = "termius-clone-sync.tcsync";
const OAUTH_SCOPE: &str =
    "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email";
const LOGIN_SCOPE: &str = "openid email profile";

// ── Public data types ──────────────────────────────────────────────────────

/// Returned by `auth_flow` to be persisted by the caller.
pub struct AuthResult {
    pub access_token: String,
    pub refresh_token: String,
    pub email: String,
}

/// Returned by `login_flow` with user profile info.
pub struct LoginResult {
    pub email: String,
    pub name: String,
    pub picture: String,
}

/// A refreshed access token, returned when the original was expired.
pub struct TokenRefreshResult {
    pub access_token: String,
}

// ── PKCE helpers ───────────────────────────────────────────────────────────

fn generate_pkce() -> (String, String) {
    let charset: Vec<char> =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
            .chars()
            .collect();
    let verifier: String = (0..64)
        .map(|_| charset[rand::thread_rng().gen_range(0..charset.len())])
        .collect();
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    (verifier, challenge)
}

// ── Google API response shapes ─────────────────────────────────────────────

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct UserInfo {
    email: Option<String>,
    name: Option<String>,
    picture: Option<String>,
}

#[derive(Deserialize)]
struct FileList {
    files: Vec<DriveFile>,
}

#[derive(Deserialize)]
struct DriveFile {
    id: String,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct UploadedFile {
    id: String,
}

// ── Auth flow ──────────────────────────────────────────────────────────────

/// Full OAuth2 PKCE authorization code flow.
/// Opens the browser, waits up to 5 minutes for the redirect, exchanges the
/// code for tokens, and fetches the user's email.
pub async fn auth_flow(client_id: &str, client_secret: &str) -> Result<AuthResult, String> {
    // Bind a random local port for the redirect URI
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Cannot bind local port: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    let (verifier, challenge) = generate_pkce();

    let auth_url = format!(
        "{AUTH_ENDPOINT}?client_id={cid}&redirect_uri={redir}&response_type=code\
         &scope={scope}&access_type=offline&prompt=consent\
         &code_challenge={challenge}&code_challenge_method=S256",
        cid = url_encode(client_id),
        redir = url_encode(&redirect_uri),
        scope = url_encode(OAUTH_SCOPE),
    );

    open_browser(&auth_url)?;

    // 5-minute timeout for the user to complete the browser flow
    let code = tokio::time::timeout(
        std::time::Duration::from_secs(300),
        wait_for_code(listener),
    )
    .await
    .map_err(|_| "Google auth timed out (5 minutes)".to_string())??;

    let client = Client::new();
    let resp = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", &redirect_uri),
            ("grant_type", "authorization_code"),
            ("code_verifier", &verifier),
        ])
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {text}"));
    }

    let tokens: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;

    let user_info: UserInfo = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(&tokens.access_token)
        .send()
        .await
        .map_err(|e| format!("Userinfo request failed: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(AuthResult {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token.unwrap_or_default(),
        email: user_info.email.unwrap_or_else(|| "unknown@gmail.com".to_string()),
    })
}

// ── Login flow (identity only) ─────────────────────────────────────────────

/// OAuth2 PKCE flow for user identity (openid email profile scope).
/// Does NOT require Drive access. Returns user profile info.
pub async fn login_flow(client_id: &str, client_secret: &str) -> Result<LoginResult, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Cannot bind local port: {e}"))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    let (verifier, challenge) = generate_pkce();

    let auth_url = format!(
        "{AUTH_ENDPOINT}?client_id={cid}&redirect_uri={redir}&response_type=code\
         &scope={scope}&access_type=online&prompt=select_account\
         &code_challenge={challenge}&code_challenge_method=S256",
        cid = url_encode(client_id),
        redir = url_encode(&redirect_uri),
        scope = url_encode(LOGIN_SCOPE),
    );

    open_browser(&auth_url)?;

    let code = tokio::time::timeout(
        std::time::Duration::from_secs(300),
        wait_for_code(listener),
    )
    .await
    .map_err(|_| "Google auth timed out (5 minutes)".to_string())??;

    let client = Client::new();
    let resp = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", &redirect_uri),
            ("grant_type", "authorization_code"),
            ("code_verifier", &verifier),
        ])
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed: {text}"));
    }

    let tokens: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;

    let info: UserInfo = client
        .get(USERINFO_ENDPOINT)
        .bearer_auth(&tokens.access_token)
        .send()
        .await
        .map_err(|e| format!("Userinfo request failed: {e}"))?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(LoginResult {
        email: info.email.unwrap_or_else(|| "unknown@gmail.com".to_string()),
        name: info.name.unwrap_or_default(),
        picture: info.picture.unwrap_or_default(),
    })
}

// ── Token refresh ──────────────────────────────────────────────────────────

/// Refreshes the access token using the stored refresh token.
/// Returns the new access token so the caller can persist it.
pub async fn refresh_token(
    client_id: &str,
    client_secret: &str,
    refresh_token: &str,
) -> Result<String, String> {
    let client = Client::new();
    let resp = client
        .post(TOKEN_ENDPOINT)
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id),
            ("client_secret", client_secret),
        ])
        .send()
        .await
        .map_err(|e| format!("Token refresh failed: {e}"))?;

    if !resp.status().is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!("Token refresh error: {t}"));
    }

    let tokens: TokenResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(tokens.access_token)
}

// ── Drive upload ───────────────────────────────────────────────────────────

/// Upload `data` bytes to Drive appDataFolder.
/// Returns `Some(new_access_token)` if the token was refreshed during the call.
pub async fn drive_upload(
    access_token: &str,
    refresh_token_val: &str,
    client_id: &str,
    client_secret: &str,
    data: Vec<u8>,
) -> Result<Option<String>, String> {
    let client = Client::new();
    let (at, refreshed) = ensure_valid_token(
        &client,
        access_token,
        refresh_token_val,
        client_id,
        client_secret,
    )
    .await?;

    // Check if a previous sync file exists
    let existing_id = find_sync_file_id(&client, &at).await?;

    match existing_id {
        Some(file_id) => {
            // Update existing file content
            let url = format!(
                "https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=media"
            );
            let resp = client
                .patch(&url)
                .bearer_auth(&at)
                .header("Content-Type", "application/octet-stream")
                .body(data)
                .send()
                .await
                .map_err(|e| format!("Drive update failed: {e}"))?;
            if !resp.status().is_success() {
                let t = resp.text().await.unwrap_or_default();
                return Err(format!("Drive update error: {t}"));
            }
        }
        None => {
            // Create new file via multipart
            let boundary = "termius_boundary_xyz";
            let metadata = format!(
                r#"{{"name":"{SYNC_FILENAME}","parents":["appDataFolder"]}}"#
            );
            let mut body = format!(
                "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n\
                 --{boundary}\r\nContent-Type: application/octet-stream\r\n\r\n"
            )
            .into_bytes();
            body.extend_from_slice(&data);
            body.extend_from_slice(format!("\r\n--{boundary}--").as_bytes());

            let url = "https://www.googleapis.com/upload/drive/v3/files\
                       ?uploadType=multipart&spaces=appDataFolder";
            let resp = client
                .post(url)
                .bearer_auth(&at)
                .header(
                    "Content-Type",
                    format!("multipart/related; boundary={boundary}"),
                )
                .body(body)
                .send()
                .await
                .map_err(|e| format!("Drive create failed: {e}"))?;
            if !resp.status().is_success() {
                let t = resp.text().await.unwrap_or_default();
                return Err(format!("Drive create error: {t}"));
            }
        }
    }

    Ok(refreshed)
}

// ── Drive download ─────────────────────────────────────────────────────────

/// Download the sync file from Drive appDataFolder.
/// Returns `(file_bytes, Option<new_access_token>)`.
pub async fn drive_download(
    access_token: &str,
    refresh_token_val: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<(Vec<u8>, Option<String>), String> {
    let client = Client::new();
    let (at, refreshed) = ensure_valid_token(
        &client,
        access_token,
        refresh_token_val,
        client_id,
        client_secret,
    )
    .await?;

    let file_id = find_sync_file_id(&client, &at)
        .await?
        .ok_or("No sync file found on Google Drive. Upload from another device first.")?;

    let url = format!("{DRIVE_FILES_ENDPOINT}/{file_id}?alt=media");
    let data = client
        .get(&url)
        .bearer_auth(&at)
        .send()
        .await
        .map_err(|e| format!("Drive download failed: {e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?
        .to_vec();

    Ok((data, refreshed))
}

// ── Internal helpers ───────────────────────────────────────────────────────

/// Validate the current access token. If expired (HTTP 401 on a probe), refresh it.
/// Returns `(valid_access_token, Some(new_token_if_refreshed))`.
async fn ensure_valid_token(
    client: &Client,
    access_token: &str,
    refresh_token_val: &str,
    client_id: &str,
    client_secret: &str,
) -> Result<(String, Option<String>), String> {
    let probe = client
        .get(format!("{DRIVE_FILES_ENDPOINT}?spaces=appDataFolder&pageSize=1"))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if probe.status().as_u16() != 401 {
        return Ok((access_token.to_string(), None));
    }

    // Need refresh
    if refresh_token_val.is_empty() {
        return Err("Session expired. Please sign in with Google again.".to_string());
    }
    let new_at = refresh_token(client_id, client_secret, refresh_token_val).await?;
    Ok((new_at.clone(), Some(new_at)))
}

async fn find_sync_file_id(client: &Client, access_token: &str) -> Result<Option<String>, String> {
    let url = format!(
        "{DRIVE_FILES_ENDPOINT}?spaces=appDataFolder&q=name%3D'{SYNC_FILENAME}'&fields=files(id)"
    );
    let resp = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("Drive list failed: {e}"))?;

    if !resp.status().is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!("Drive list error: {t}"));
    }

    let list: FileList = resp.json().await.map_err(|e| e.to_string())?;
    Ok(list.files.into_iter().next().map(|f| f.id))
}

async fn wait_for_code(listener: TcpListener) -> Result<String, String> {
    let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; 8192];
    let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
    let request = String::from_utf8_lossy(&buf[..n]);

    let code = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|path| path.split('?').nth(1))
        .and_then(|qs| qs.split('&').find(|p| p.starts_with("code=")))
        .map(|p| p.trim_start_matches("code=").to_string())
        .ok_or("OAuth callback did not contain a code")?;

    let html = "<html><body style='font-family:sans-serif;text-align:center;padding:60px'>\
                <h2 style='color:#4CAF50'>&#10003; Đăng nhập thành công!</h2>\
                <p>Bạn có thể đóng tab này và quay lại <strong>TermiusClone</strong>.</p>\
                </body></html>";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
        html.len(), html
    );
    stream.write_all(response.as_bytes()).await.ok();
    Ok(code)
}

fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let res = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let res = std::process::Command::new("cmd")
        .args(["/c", "start", "", url])
        .spawn();
    #[cfg(target_os = "linux")]
    let res = std::process::Command::new("xdg-open").arg(url).spawn();
    res.map_err(|e| format!("Failed to open browser: {e}"))?;
    Ok(())
}

fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
