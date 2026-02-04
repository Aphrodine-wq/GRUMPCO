# G-Rump Deployment

## NGC-Ready Cloud (NVIDIA Golden Developer)

Deploy on NGC-certified clouds (GCP, AWS) for NVIDIA Golden Developer Award compliance:

- **[deploy/ngc/](ngc/README.md)** — NGC deployment overview
- **[GCP](ngc/gcp/)** — `provision.sh`, `deploy.sh` for Google Cloud
- **[AWS](ngc/aws/)** — `provision.sh`, `deploy.sh` for Amazon Web Services

```bash
cd ngc/gcp && ./provision.sh && ./deploy.sh   # GCP
cd ngc/aws && ./provision.sh && ./deploy.sh   # AWS
```

## Daemon Installation

### macOS (launchd)

1. Copy `launchd/com.grump.backend.plist` to `~/Library/LaunchAgents/` or `/Library/LaunchDaemons/`
2. Edit paths in the plist to match your installation (`/opt/grump/backend` or project path)
3. Create log directory: `sudo mkdir -p /var/log/grump && sudo chown $USER /var/log/grump`
4. Load: `launchctl load ~/Library/LaunchAgents/com.grump.backend.plist`

### Linux (systemd)

1. Copy `systemd/grump-backend.service` to `/etc/systemd/system/`
2. Edit `WorkingDirectory` and paths as needed
3. Run: `sudo systemctl daemon-reload && sudo systemctl enable grump-backend && sudo systemctl start grump-backend`

## Installation from npm

```bash
npm install -g grump
grump daemon install   # Copies plist/systemd, prompts for paths
```

See [docs/REMOTE_ACCESS.md](../docs/REMOTE_ACCESS.md) for Tailscale, SSH tunnels, and Bonjour.
