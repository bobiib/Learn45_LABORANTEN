#!/usr/bin/env bash
# Start the full app: FastAPI backend on :8000 and Vite frontend on :5173.
# Installs missing dependencies and asks for a Gemini API key on first run.
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

has_api_key() {
  [[ -f "$BACKEND_DIR/.env" ]] && grep -qE '^GEMINI_API_KEY=[^[:space:]]+' "$BACKEND_DIR/.env"
}

port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

for PORT in 8000 5173; do
  if port_in_use "$PORT"; then
    echo "Port $PORT is already in use, probably by an earlier run of the app."
    echo "Close the other terminal window running it (or press Ctrl+C there) and try again."
    exit 1
  fi
done

if ! has_api_key; then
  if [[ -t 0 ]]; then
    "$PROJECT_DIR/scripts/set-api-key.sh"
  else
    echo "Gemini API key is missing. Run 'make api-key' (or add GEMINI_API_KEY=... to backend/.env) and try again."
    exit 1
  fi
fi

if [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" || ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
  echo "First start: installing dependencies. This takes a few minutes…"
  "$PROJECT_DIR/scripts/install.sh"
fi

echo ""
echo "Starting Lea backend at http://localhost:8000 …"
"$BACKEND_DIR/.venv/bin/uvicorn" main:app --app-dir "$BACKEND_DIR" --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo "Starting Lea frontend at http://localhost:5173 …"
(
  cd "$FRONTEND_DIR"
  VITE_DEMO_MODE=false VITE_API_BASE_URL=/api npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
) &
FRONTEND_PID=$!

echo ""
echo "  ➜ Open http://localhost:5173 in your browser."
echo "  ➜ Press Ctrl+C in this window to stop the app."
echo ""

# Stop as soon as either service exits (portable replacement for `wait -n`,
# which the bash 3.2 shipped with macOS does not support).
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done
echo "One of the services stopped. Shutting down the other one…"
exit 1
