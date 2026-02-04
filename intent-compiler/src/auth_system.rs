//! Authentication System - JWT tokens, sessions, and access control
//! Integrates with existing G-Rump auth while adding founder API keys

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// JWT Token Management
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtToken {
    pub token: String,
    pub expires_at: String,
    pub token_type: String, // Bearer, ApiKey
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: String,              // subject (user_id or founder_id)
    pub founder_id: String,
    pub email: Option<String>,
    pub iat: i64,                 // issued at
    pub exp: i64,                 // expires at
    pub permissions: Vec<String>, // verdict:read, outcome:write, etc
}

pub struct JwtManager {
    secret_key: String,
    token_expiry_hours: i32,
}

impl JwtManager {
    pub fn new(secret_key: &str, token_expiry_hours: i32) -> Self {
        Self {
            secret_key: secret_key.to_string(),
            token_expiry_hours,
        }
    }

    /// Generate JWT token
    pub fn generate_token(
        &self,
        founder_id: &str,
        email: Option<&str>,
        permissions: Vec<&str>,
    ) -> Result<JwtToken, AuthError> {
        // In production: use jsonwebtoken crate
        // 1. Create claims with exp = now + token_expiry_hours
        // 2. Sign with secret key
        // 3. Return JWT

        let expiry = chrono::Local::now()
            .checked_add_signed(chrono::Duration::hours(self.token_expiry_hours as i64))
            .unwrap();

        Ok(JwtToken {
            token: format!("jwt.{}.{}", founder_id, uuid()),
            expires_at: expiry.to_rfc3339(),
            token_type: "Bearer".to_string(),
        })
    }

    /// Verify JWT token
    pub fn verify_token(&self, token: &str) -> Result<JwtClaims, AuthError> {
        // In production: use jsonwebtoken crate to verify signature

        // Check if expired
        // Check if signature valid
        // Return claims

        Ok(JwtClaims {
            sub: "user123".to_string(),
            founder_id: "alice-chen".to_string(),
            email: Some("alice@example.com".to_string()),
            iat: 1234567890,
            exp: 1234571490,
            permissions: vec![
                "verdict:read".to_string(),
                "outcome:write".to_string(),
            ],
        })
    }

    /// Refresh token
    pub fn refresh_token(&self, token: &str) -> Result<JwtToken, AuthError> {
        let claims = self.verify_token(token)?;
        self.generate_token(
            &claims.founder_id,
            claims.email.as_deref(),
            claims.permissions.iter().map(|s| s.as_str()).collect(),
        )
    }
}

// ============================================================================
// API Key Management
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    pub key_id: String,
    pub key_secret: String,
    pub founder_id: String,
    pub name: String,
    pub permissions: Vec<String>,
    pub created_at: String,
    pub last_used: Option<String>,
    pub is_active: bool,
}

pub struct ApiKeyManager {
    keys: HashMap<String, ApiKey>,
}

impl ApiKeyManager {
    pub fn new() -> Self {
        Self {
            keys: HashMap::new(),
        }
    }

    /// Generate new API key
    pub fn generate_key(
        &mut self,
        founder_id: &str,
        name: &str,
        permissions: Vec<&str>,
    ) -> Result<ApiKey, AuthError> {
        // In production: store securely (hashed) in database

        let key_id = format!("key_{}", uuid());
        let key_secret = format!("grump_sk_{}", uuid());

        let api_key = ApiKey {
            key_id: key_id.clone(),
            key_secret: key_secret.clone(),
            founder_id: founder_id.to_string(),
            name: name.to_string(),
            permissions: permissions.iter().map(|p| p.to_string()).collect(),
            created_at: chrono::Local::now().to_rfc3339(),
            last_used: None,
            is_active: true,
        };

        self.keys.insert(key_id, api_key.clone());

        Ok(api_key)
    }

    /// Verify API key
    pub fn verify_key(&mut self, key_id: &str, key_secret: &str) -> Result<ApiKey, AuthError> {
        if let Some(api_key) = self.keys.get_mut(key_id) {
            if api_key.key_secret == key_secret && api_key.is_active {
                // Update last_used
                api_key.last_used = Some(chrono::Local::now().to_rfc3339());
                return Ok(api_key.clone());
            }
        }

        Err(AuthError::InvalidApiKey)
    }

    /// Revoke API key
    pub fn revoke_key(&mut self, key_id: &str) -> Result<(), AuthError> {
        if let Some(api_key) = self.keys.get_mut(key_id) {
            api_key.is_active = false;
            Ok(())
        } else {
            Err(AuthError::KeyNotFound)
        }
    }

    /// Get all keys for founder
    pub fn get_founder_keys(&self, founder_id: &str) -> Vec<ApiKey> {
        self.keys
            .values()
            .filter(|k| k.founder_id == founder_id && k.is_active)
            .cloned()
            .collect()
    }
}

impl Default for ApiKeyManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Session Management
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub session_id: String,
    pub founder_id: String,
    pub created_at: String,
    pub expires_at: String,
    pub last_activity: String,
    pub ip_address: String,
    pub user_agent: String,
}

pub struct SessionManager {
    sessions: HashMap<String, Session>,
    session_timeout_hours: i32,
}

impl SessionManager {
    pub fn new(session_timeout_hours: i32) -> Self {
        Self {
            sessions: HashMap::new(),
            session_timeout_hours,
        }
    }

    /// Create new session
    pub fn create_session(
        &mut self,
        founder_id: &str,
        ip_address: &str,
        user_agent: &str,
    ) -> Result<Session, AuthError> {
        let session_id = format!("sess_{}", uuid());
        let now = chrono::Local::now();
        let expires_at = now
            .checked_add_signed(chrono::Duration::hours(self.session_timeout_hours as i64))
            .unwrap();

        let session = Session {
            session_id: session_id.clone(),
            founder_id: founder_id.to_string(),
            created_at: now.to_rfc3339(),
            expires_at: expires_at.to_rfc3339(),
            last_activity: now.to_rfc3339(),
            ip_address: ip_address.to_string(),
            user_agent: user_agent.to_string(),
        };

        self.sessions.insert(session_id, session.clone());
        Ok(session)
    }

    /// Validate session
    pub fn validate_session(&self, session_id: &str) -> Result<Session, AuthError> {
        if let Some(session) = self.sessions.get(session_id) {
            // Check if not expired
            let now = chrono::Local::now();
            let expires = chrono::DateTime::parse_from_rfc3339(&session.expires_at)
                .map_err(|_| AuthError::SessionExpired)?;

            if now.timestamp() < expires.timestamp() {
                return Ok(session.clone());
            }
        }

        Err(AuthError::SessionExpired)
    }

    /// Invalidate session
    pub fn invalidate_session(&mut self, session_id: &str) -> Result<(), AuthError> {
        self.sessions.remove(session_id);
        Ok(())
    }
}

// ============================================================================
// Permission System
// ============================================================================

#[derive(Debug, Clone, PartialEq)]
pub enum Permission {
    // Verdict permissions
    VerdictRead,
    VerdictWrite,

    // Outcome permissions
    OutcomeRead,
    OutcomeWrite,

    // Network permissions
    NetworkRead,
    NetworkWrite,

    // Model permissions
    ModelRead,
    ModelWrite,

    // Admin permissions
    AdminAccess,
}

pub struct PermissionChecker;

impl PermissionChecker {
    /// Check if user has permission
    pub fn has_permission(permissions: &[String], required: &Permission) -> bool {
        let required_str = match required {
            Permission::VerdictRead => "verdict:read",
            Permission::VerdictWrite => "verdict:write",
            Permission::OutcomeRead => "outcome:read",
            Permission::OutcomeWrite => "outcome:write",
            Permission::NetworkRead => "network:read",
            Permission::NetworkWrite => "network:write",
            Permission::ModelRead => "model:read",
            Permission::ModelWrite => "model:write",
            Permission::AdminAccess => "admin:access",
        };

        permissions.iter().any(|p| p == required_str || p == "*")
    }

    /// Check multiple permissions (AND)
    pub fn has_all_permissions(permissions: &[String], required: &[Permission]) -> bool {
        required
            .iter()
            .all(|perm| Self::has_permission(permissions, perm))
    }

    /// Check multiple permissions (OR)
    pub fn has_any_permission(permissions: &[String], required: &[Permission]) -> bool {
        required
            .iter()
            .any(|perm| Self::has_permission(permissions, perm))
    }
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug)]
pub enum AuthError {
    InvalidToken,
    TokenExpired,
    InvalidApiKey,
    KeyNotFound,
    SessionExpired,
    PermissionDenied,
    InvalidCredentials,
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::InvalidToken => write!(f, "Invalid token"),
            AuthError::TokenExpired => write!(f, "Token expired"),
            AuthError::InvalidApiKey => write!(f, "Invalid API key"),
            AuthError::KeyNotFound => write!(f, "API key not found"),
            AuthError::SessionExpired => write!(f, "Session expired"),
            AuthError::PermissionDenied => write!(f, "Permission denied"),
            AuthError::InvalidCredentials => write!(f, "Invalid credentials"),
        }
    }
}

impl std::error::Error for AuthError {}

// ============================================================================
// Utilities
// ============================================================================

fn uuid() -> String {
    format!("{:x}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos())
}

// Mock chrono for standalone compilation
mod chrono {
    use std::time::{SystemTime, UNIX_EPOCH};

    pub struct Local;
    impl Local {
        pub fn now() -> DateTime {
            DateTime {
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs() as i64,
            }
        }
    }

    pub struct Duration(i64);
    impl Duration {
        pub fn hours(h: i64) -> Self {
            Duration(h * 3600)
        }
    }

    pub struct DateTime {
        timestamp: i64,
    }

    impl DateTime {
        pub fn checked_add_signed(self, dur: Duration) -> Option<DateTime> {
            Some(DateTime {
                timestamp: self.timestamp + dur.0,
            })
        }

        pub fn to_rfc3339(&self) -> String {
            format!("2024-02-03T{:02}:00:00Z", self.timestamp % 24)
        }

        pub fn timestamp(&self) -> i64 {
            self.timestamp
        }

        pub fn parse_from_rfc3339(s: &str) -> Result<DateTimeWithTz, ()> {
            Ok(DateTimeWithTz {
                timestamp: 1234567890,
            })
        }
    }

    pub struct DateTimeWithTz {
        timestamp: i64,
    }

    impl DateTimeWithTz {
        pub fn timestamp(&self) -> i64 {
            self.timestamp
        }
    }
}
