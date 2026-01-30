#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "============================================"
echo "       AgentLightning Store (OTLP)"
echo "============================================"
echo ""

if ! command -v python >/dev/null 2>&1; then
  echo "[ERROR] Python not found! Install Python 3.10+ first."
  exit 1
fi

if [ ! -f "$ROOT/agentlightning/requirements.txt" ]; then
  echo "[ERROR] Missing agentlightning/requirements.txt"
  exit 1
fi

echo "If dependencies are missing, run:"
echo "  python -m pip install -r $ROOT/agentlightning/requirements.txt"
echo ""

echo "Starting AgentLightning store on http://localhost:4747 ..."
cd "$ROOT"
python -m agentlightning.cli.store --host 0.0.0.0 --port 4747 \
  --cors-origin http://localhost:3000 \
  --cors-origin http://127.0.0.1:3000 \
  --cors-origin http://localhost:5173 \
  --cors-origin http://127.0.0.1:5173 \
  --cors-origin http://localhost:5178 \
  --cors-origin http://127.0.0.1:5178
