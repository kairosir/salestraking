#!/bin/sh
set -e

ENV_FILE="${1:-.env}"
TARGET="${2:-production}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

if [ -z "$VERCEL_TOKEN" ]; then
  echo "VERCEL_TOKEN is required"
  exit 1
fi

sync_key() {
  key="$1"
  value="$(grep -E "^${key}=" "$ENV_FILE" | head -n1 | cut -d'=' -f2- | sed 's/^"//; s/"$//')"

  if [ -z "$value" ]; then
    echo "Skip $key (empty or missing)"
    return 0
  fi

  vercel env rm "$key" "$TARGET" --yes --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
  printf "%s" "$value" | vercel env add "$key" "$TARGET" --token "$VERCEL_TOKEN"
  echo "Synced $key -> $TARGET"
}

sync_key DATABASE_URL
sync_key NEXTAUTH_SECRET
sync_key NEXTAUTH_URL
sync_key GOOGLE_CLIENT_ID
sync_key GOOGLE_CLIENT_SECRET
sync_key APPLE_ID
sync_key APPLE_SECRET

echo "Done. Vercel env synced from $ENV_FILE to $TARGET."
