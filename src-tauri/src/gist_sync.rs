/// GitHub Gist sync module.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;

const API_BASE: &str = "https://api.github.com";
const GIST_FILENAME: &str = "termius-clone-sync.b64";

#[derive(Deserialize)]
struct GistFile {
    content: Option<String>,
}

#[derive(Deserialize)]
struct GistResponse {
    id: String,
    files: HashMap<String, GistFile>,
}

#[derive(Deserialize)]
struct UserResponse {
    login: String,
}

fn client() -> Client {
    Client::builder()
        .user_agent("TermiusClone/1.0")
        .build()
        .expect("HTTP client build failed")
}

/// Validate the PAT and return the GitHub username.
pub async fn validate_token(token: &str) -> Result<String, String> {
    let resp = client()
        .get(format!("{API_BASE}/user"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if resp.status().as_u16() == 401 {
        return Err("Token không hợp lệ. Vui lòng kiểm tra lại Personal Access Token.".to_string());
    }
    if !resp.status().is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!("GitHub API error: {t}"));
    }

    let user: UserResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(user.login)
}

/// Upload encrypted data to a (private) Gist.
/// Creates a new Gist on the first call; updates the existing one afterwards.
/// Returns the Gist ID so the caller can persist it.
pub async fn upload_gist(
    token: &str,
    gist_id: Option<&str>,
    data: Vec<u8>,
) -> Result<String, String> {
    let encoded = STANDARD.encode(&data);

    let mut files = serde_json::Map::new();
    files.insert(
        GIST_FILENAME.to_string(),
        serde_json::json!({ "content": encoded }),
    );
    let body = serde_json::json!({
        "description": "TermiusClone sync backup",
        "public": false,
        "files": files,
    });

    let resp = if let Some(id) = gist_id {
        client()
            .patch(format!("{API_BASE}/gists/{id}"))
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Upload failed: {e}"))?
    } else {
        client()
            .post(format!("{API_BASE}/gists"))
            .bearer_auth(token)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Create gist failed: {e}"))?
    };

    if !resp.status().is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!("Gist API error: {t}"));
    }

    let gist: GistResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(gist.id)
}

/// Download and decode the sync data from a Gist.
pub async fn download_gist(token: &str, gist_id: &str) -> Result<Vec<u8>, String> {
    let resp = client()
        .get(format!("{API_BASE}/gists/{gist_id}"))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    if resp.status().as_u16() == 404 {
        return Err("Gist không tìm thấy. Vui lòng upload từ thiết bị khác trước.".to_string());
    }
    if !resp.status().is_success() {
        let t = resp.text().await.unwrap_or_default();
        return Err(format!("Gist API error: {t}"));
    }

    let gist: GistResponse = resp.json().await.map_err(|e| e.to_string())?;
    let encoded = gist
        .files
        .get(GIST_FILENAME)
        .and_then(|f| f.content.as_ref())
        .ok_or("Sync file không tìm thấy trong Gist. Có thể đã bị xóa.")?;

    STANDARD.decode(encoded).map_err(|e| format!("Decode error: {e}"))
}
