#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  [[ -z "$FRONTEND_PID" ]] || wait "$FRONTEND_PID" 2>/dev/null || true
  [[ -z "$BACKEND_PID" ]] || wait "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

if [[ ! -f "$BACKEND_DIR/.env" ]] || ! grep -qE '^GEMINI_API_KEY=.+$' "$BACKEND_DIR/.env"; then
  echo "Gemini API key is missing. Add it to backend/.env as GEMINI_API_KEY=... and run ./start.sh again."
  exit 1
fi

if [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]]; then
  echo "Setting up backend dependencies…"
  python3 -m venv "$BACKEND_DIR/.venv"
  "$BACKEND_DIR/.venv/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Setting up frontend dependencies…"
  (cd "$FRONTEND_DIR" && npm install)
fi

echo "Starting Lea backend at http://localhost:8000 …"
"$BACKEND_DIR/.venv/bin/uvicorn" main:app --app-dir "$BACKEND_DIR" --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Starting Lea frontend at http://localhost:5173 …"
(
  cd "$FRONTEND_DIR"
  VITE_DEMO_MODE=false VITE_API_BASE_URL=/api npm run dev -- --host 127.0.0.1
) &
FRONTEND_PID=$!

echo "Both services are running. Press Ctrl+C to stop them."
wait -n "$BACKEND_PID" "$FRONTEND_PID"
