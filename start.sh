#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
    echo "Shutting down..."
    trap - EXIT INT TERM   # prevent re-entry when kill 0 exits the shell
    kill 0 2>/dev/null || true
    wait 2>/dev/null || true
}

trap cleanup EXIT INT TERM

cd "$SCRIPT_DIR/backend"
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload &

cd "$SCRIPT_DIR/frontend"
pnpm dev &

echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both."

wait
