# Release Checklist — v2.1.0

Use this checklist to ship quickly without missing critical steps.

## 1) Code Quality
- [x] `pnpm run build:packages` — shared packages build
- [x] `npm run check-all` — 0 TypeScript errors (frontend + backend)
- [x] Backend `tsc --noEmit` — 0 errors
- [x] Frontend `svelte-check` — 0 errors, warnings only (CSS/a11y cosmetic)
- [x] Vitest aligned to v1.6 (tests execute correctly)

## 2) Documentation & Assets
- [x] `README.md` — polished, badges, screenshots, quick start
- [x] `docs/GETTING_STARTED.md` — complete walkthrough
- [x] `docs/SECURITY.md` and `docs/SECURITY_BASELINE.md` — set
- [x] `docs/CHANGELOG.md` — current for v2.1.0
- [x] `docs/ROADMAP.md` — v2.1 marked shipped
- [x] `PRD.md` — version 2.1.0, status "Released"
- [x] `LICENSE` — MIT verified
- [x] `.env.example` (root + backend) — documented
- [x] Screenshot assets present (`docs/assets/`)

## 3) Website (Self-Hosted)
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

## 4) Windows Desktop App
- [ ] `npm run electron:build` succeeds
- [ ] Installer created (`frontend/electron-dist/G-Rump.exe`)
- [ ] `backend/.env` path documented
- [ ] Smoke test: app launches and connects to backend

## 5) CLI
- [ ] `npm i -g grump-cli` works
- [ ] `grump auth login` succeeds
- [ ] `grump ship "hello"` completes

## 6) Final Sign-Off
- [ ] End-to-end smoke test (startup → chat → SHIP)
- [ ] Production environment check (`node scripts/check-release-env.js`)
- [ ] Git tag `v2.1.0` created
