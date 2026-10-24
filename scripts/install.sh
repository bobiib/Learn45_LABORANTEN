#!/usr/bin/env bash
# Check prerequisites and install backend (Python) and frontend (Node) dependencies.
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
MODE="${1:-all}"  # all | frontend

fail() {
  echo ""
  echo "✗ $1"
  exit 1
}

check_node() {
  command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install the LTS version from https://nodejs.org and try again."
  command -v npm >/dev/null 2>&1 || fail "npm is not installed. It comes with Node.js: reinstall it from https://nodejs.org."
  node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
    process.exit(ok ? 0 : 1);
  ' || fail "Node.js $(node --version) is too old. Install the LTS version (22 or newer) from https://nodejs.org."
}

check_python() {
  command -v python3 >/dev/null 2>&1 || fail "Python 3 is not installed. Install Python 3.10 or newer from https://www.python.org/downloads/."
  python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' \
    || fail "Python $(python3 --version 2>&1) is too old. Install Python 3.10 or newer from https://www.python.org/downloads/."
}

install_frontend() {
  echo "→ Installing frontend dependencies (npm install)…"
  (cd "$FRONTEND_DIR" && npm install --no-fund --no-audit)
}

install_backend() {
  if [[ ! -x "$BACKEND_DIR/.venv/bin/python" ]]; then
    echo "→ Creating Python environment in backend/.venv…"
    python3 -m venv "$BACKEND_DIR/.venv" \
      || fail "Could not create a Python environment. On Debian/Ubuntu run: sudo apt install python3-venv"
  fi
  echo "→ Installing backend dependencies (pip install)…"
  "$BACKEND_DIR/.venv/bin/python" -m pip install --quiet --disable-pip-version-check -r "$BACKEND_DIR/requirements.txt"
}

check_node
install_frontend
if [[ "$MODE" != "frontend" ]]; then
  check_python
  install_backend
fi

echo "✓ Dependencies are installed."
