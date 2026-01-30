# Getting Started (Users)

Pick the path that matches how you want to use G‑Rump.

## 1) Website (self‑hosted)

Best for teams or shared use.

1. Deploy backend + frontend (see `backend/DEPLOY_VERCEL.md` or `DEPLOYMENT_SUMMARY.md`).
2. Apply production security (`docs/SECURITY_BASELINE.md`).
3. Open your web URL and sign in.

## 2) Windows Desktop App

Best for a local, no‑browser experience.

1. Build or download the installer:
   - Build locally with `build-windows.bat` (see `docs/BUILD.md`).
2. Install the app.
3. Add your API key:
   - Create `%APPDATA%\\com.grump.app\\.env`
   - Set `NVIDIA_NIM_API_KEY=...` or `OPENROUTER_API_KEY=...`
4. Launch G‑Rump from the Start Menu.

## 3) CLI

Best for scripts and terminal workflows.

```bash
npm install -g grump-cli
grump config set apiUrl http://localhost:3000
grump auth login
grump ship "Build a todo app with auth"
```

Notes:
- Default API URL is `http://localhost:3000`.
- Set `GRUMP_API_URL` / `GRUMP_API_KEY` for CI or scripts.
