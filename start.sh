#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

trap 'echo "Shutting down..."; kill 0' EXIT INT TERM

cd "$SCRIPT_DIR/backend"
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload &

cd "$SCRIPT_DIR/frontend"
pnpm dev &

echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both."

wait
