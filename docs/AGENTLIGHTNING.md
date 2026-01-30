# AgentLightning Overwatch

G-Rump already emits OpenTelemetry spans for agent activity. Running the AgentLightning store lets you collect and inspect those traces locally (OTLP/HTTP).

## Quick setup (local)

1. Install Python 3.10+.
2. Install dependencies:
   - `python -m pip install -r agentlightning/requirements.txt`
3. Start the store:
   - Windows: `scripts/agentlightning-start.bat`
   - macOS/Linux: `scripts/agentlightning-start.sh`
4. Set the OTLP endpoint in `backend/.env`:
   - `OTLP_ENDPOINT=http://localhost:4747`
5. Restart the backend.

## One-command dev (Windows)

Use `start-app-with-agentlightning.bat` to start the store and the G-Rump stack with tracing enabled.

## Verify

- Health: `http://localhost:4747/v1/agl/health`
- API docs: `http://localhost:4747/docs`
- OTLP traces: `http://localhost:4747/v1/traces`

## Persistence

By default the store uses in-memory storage (data is lost on restart). For persistence, use MongoDB:

```bash
python -m agentlightning.cli.store --backend mongo --mongo-uri mongodb://localhost:27017/?replicaSet=rs0
```

## Security notes

- Keep the store bound to localhost in production, or put it behind a reverse proxy with auth and TLS.
- Use explicit CORS origins (avoid `*`).
- Do not expose `/v1/traces` publicly.
