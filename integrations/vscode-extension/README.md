# G-Rump VS Code Extension

Connects VS Code to the G-Rump API for chat, SHIP, and codegen.

## Features

- **G-Rump: New from description** – Opens a prompt, sends description to `POST /api/ship/start`, starts a SHIP session.
- **G-Rump: Open chat** – Focuses the G-Rump Chat view.
- **Status bar** – “G-Rump” item in the status bar (bottom-right); click to open the Chat view.
- **Chat view** – Sidebar view that streams from `POST /api/chat/stream`. Type a message and see the streamed reply.

## Setup

1. **API URL**: Set `grump.apiUrl` (default `http://localhost:3000`) in VS Code settings.
2. **API key** (optional): Set `grump.apiKey` if your backend requires it.
3. **Build**: From `integrations/vscode-extension`, run `npm install` and `npm run compile`.
4. **Run**: F5 to launch Extension Development Host, or package and install the VSIX.

**Marketplace**: Add `media/icon.png` (128×128) before publishing. Run `vsce package` to create a VSIX. Publish with `vsce publish` (requires `publisher` and Marketplace token).

## Commands

| Command | Description |
|---------|-------------|
| G-Rump: New from description | Prompt for app description, start SHIP via API |
| G-Rump: Open chat | Focus the G-Rump Chat view |
| G-Rump (status bar) | Click to open Chat view |

## Settings

| Key | Default | Description |
|-----|---------|-------------|
| `grump.apiUrl` | `http://localhost:3000` | G-Rump API base URL |
| `grump.apiKey` | `""` | API key if required |
