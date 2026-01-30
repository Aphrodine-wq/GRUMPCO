# Release Checklist (Fast Finish)

Use this checklist to ship quickly without missing critical steps.

## 1) Website (Self‑Hosted)
- [ ] Backend deployed (Vercel or equivalent)
- [ ] Frontend deployed and points to backend
- [ ] `CORS_ORIGINS` set (no wildcards)
- [ ] `REQUIRE_AUTH_FOR_API=true`
- [ ] `BLOCK_SUSPICIOUS_PROMPTS=true`
- [ ] `SECURITY_STRICT_PROD=true`
- [ ] `OUTPUT_FILTER_PII=true`, `OUTPUT_FILTER_HARMFUL=true`
- [ ] `STRICT_COMMAND_ALLOWLIST=true`
- [ ] `ALLOWED_HOSTS` set to production domains
- [ ] `/health` and `/metrics` verify OK

## 2) Windows Desktop App
- [ ] `build-windows.bat` succeeds
- [ ] Installer created (`frontend/src-tauri/target/release/bundle`)
- [ ] `%APPDATA%\\com.grump.app\\.env` path documented
- [ ] Smoke test: app launches and connects to backend

## 3) CLI
- [ ] `npm i -g grump-cli` works
- [ ] `grump auth login` succeeds
- [ ] `grump ship "hello"` completes

## 4) Docs & OSS
- [ ] `README.md` points to quick setup
- [ ] `docs/GETTING_STARTED.md` checked
- [ ] `SECURITY.md` and `SECURITY_BASELINE.md` set
- [ ] `LICENSE` verified
