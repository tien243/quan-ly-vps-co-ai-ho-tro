use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use sha2::{Digest, Sha256};

const MASTER_KEY_SEED: &[u8] = b"termius-clone-v1-master-key-seed";

fn derive_key() -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(MASTER_KEY_SEED);
    hasher.finalize().into()
}

pub fn encrypt(plaintext: &str) -> Result<String, String> {
    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;

    // Prepend nonce to ciphertext, then base64 encode
    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);
    Ok(STANDARD.encode(combined))
}

pub fn decrypt(encoded: &str) -> Result<String, String> {
    let combined = STANDARD.decode(encoded).map_err(|e| e.to_string())?;
    if combined.len() < 12 {
        return Err("Invalid encrypted data".to_string());
    }
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let key = derive_key();
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed - wrong key or corrupted data".to_string())?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

pub fn fingerprint_from_pem(pem: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(pem.as_bytes());
    let hash = hasher.finalize();
    let hex_str = hex::encode(hash);
    // Format as SHA256:xx:xx:xx...
    let pairs: Vec<String> = hex_str
        .as_bytes()
        .chunks(2)
        .map(|c| std::str::from_utf8(c).unwrap_or("00").to_string())
        .collect();
    format!("SHA256:{}", pairs.join(":"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let original = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----";
        let encrypted = encrypt(original).expect("encrypt failed");
        assert_ne!(encrypted, original);
        let decrypted = decrypt(&encrypted).expect("decrypt failed");
        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_decrypt_wrong_data_fails() {
        let result = decrypt("not-valid-base64!!!");
        assert!(result.is_err());
    }

    #[test]
    fn test_fingerprint_format() {
        let fp = fingerprint_from_pem("test key material");
        assert!(fp.starts_with("SHA256:"));
        // Should have colon-separated hex pairs
        let parts: Vec<&str> = fp.splitn(2, ':').collect();
        assert_eq!(parts[0], "SHA256");
    }

    #[test]
    fn test_encrypt_produces_unique_ciphertext() {
        // Same plaintext should produce different ciphertext (random nonce)
        let plain = "same plaintext";
        let c1 = encrypt(plain).unwrap();
        let c2 = encrypt(plain).unwrap();
        // Nonces are random so ciphertexts should differ
        assert_ne!(c1, c2);
        // But both should decrypt to same value
        assert_eq!(decrypt(&c1).unwrap(), plain);
        assert_eq!(decrypt(&c2).unwrap(), plain);
    }
}
