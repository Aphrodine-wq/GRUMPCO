# ADR 0007: OS Keychain for API Key Storage

**Status:** Accepted

**Date:** January 31, 2026

## Context

API keys for AI providers (NVIDIA NIM, Anthropic, OpenRouter, etc.) need secure storage that:
- Protects against credential leakage
- Works across platforms (Windows, macOS, Linux)
- Integrates with CLI workflow
- Provides better security than .env files
- Supports migration from existing .env-based workflows

Security concerns with .env files:
- Committed to git accidentally
- Visible in process lists
- Copied to logs/terminal history
- Shared in screenshots

## Decision

Implement OS keychain integration as the primary secure storage mechanism for API keys, with encrypted file fallback.

### Implementation Details

1. **Storage Hierarchy**:
   1. OS Keychain (primary)
      - macOS: `security` command (Keychain Access)
      - Windows: Windows Credential Manager
      - Linux: `secret-tool` (libsecret) with file fallback
   2. Encrypted file storage (fallback)
      - Restricted file permissions (0o600)
      - Machine-bound encryption
   3. Environment variables (legacy support)

2. **CLI Commands**:
   ```bash
   grump secure set nvidia_nim       # Store in keychain
   grump secure get nvidia_nim       # Retrieve (masked)
   grump secure list                 # Show all stored keys
   grump secure delete nvidia_nim    # Remove from storage
   grump secure migrate              # Move from .env to keychain
   grump secure doctor               # Check storage health
   ```

3. **Security Features**:
   - Service isolation (separate keychain entries per provider)
   - No plaintext storage in repository
   - Automatic key masking in CLI output
   - Migration path from .env files
   - Health check diagnostics

## Consequences

### Positive

- **Enterprise security**: Meets security compliance requirements
- **Cross-platform**: Works on Windows, macOS, and Linux
- **User-friendly**: Simple CLI interface
- **No accidental commits**: Keys never touch the filesystem in plaintext
- **Centralized**: OS-level credential management
- **Audit trail**: OS keychains often have access logging

### Negative

- **External dependency**: Requires OS keychain services
- **Headless servers**: May require alternative configuration
- **Backup complexity**: Keys stored outside project directory
- **Team sharing**: Harder to share keys (by design)

### Neutral

- **Migration required**: Existing users must run `grump secure migrate`
- **Learning curve**: New command to learn
- **Fallback available**: File-based storage when keychain unavailable

## References

- [Secure Storage Implementation](../packages/cli/src/utils/secureStorage.ts)
- [CLI Secure Commands](../packages/cli/src/commands/secure.ts)
- [Security](./docs/SECURITY.md)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

*Supersedes: ADR 0003 (env file storage - partially)*

*Superseded by: N/A*