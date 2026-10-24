#!/usr/bin/env bash
# Ask for a Gemini API key and save it to backend/.env (never committed to Git).
set -Eeuo pipefail

PROJECT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/backend/.env"
EXAMPLE_FILE="$PROJECT_DIR/backend/.env.example"

echo ""
echo "Lea needs a Gemini API key for its AI features."
echo "Get a free key at https://aistudio.google.com/app/apikey (sign in, then click \"Create API key\")."
echo ""

KEY=""
while [[ -z "$KEY" ]]; do
  read -r -s -p "Paste your Gemini API key and press Enter (input is hidden): " KEY
  echo ""
  KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
  [[ -n "$KEY" ]] || echo "No key entered. Please try again, or press Ctrl+C to cancel."
done

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$EXAMPLE_FILE" "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

# Replace the existing GEMINI_API_KEY line, or append one if it is missing.
TMP_FILE="$(mktemp)"
GEMINI_API_KEY="$KEY" awk '
  /^GEMINI_API_KEY=/ { print "GEMINI_API_KEY=" ENVIRON["GEMINI_API_KEY"]; found = 1; next }
  { print }
  END { if (!found) print "GEMINI_API_KEY=" ENVIRON["GEMINI_API_KEY"] }
' "$ENV_FILE" > "$TMP_FILE"
cat "$TMP_FILE" > "$ENV_FILE"
rm -f "$TMP_FILE"

echo "✓ Key saved to backend/.env"
