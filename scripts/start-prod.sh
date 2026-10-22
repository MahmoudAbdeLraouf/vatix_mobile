#!/bin/sh
# Run the dev client against the production API.
# Expo's dev bundle reads .env files directly (shell vars don't override them),
# so write a temporary .env.development.local — loaded last — and remove it on exit.
set -e
cd "$(dirname "$0")/.."
ENV_FILE=.env.development.local
if [ -f "$ENV_FILE" ]; then
  echo "$ENV_FILE already exists — remove it first." >&2
  exit 1
fi
cat > "$ENV_FILE" <<'VARS'
EXPO_PUBLIC_API_URL=https://api.vatix.store
EXPO_PUBLIC_MINIO_URL=https://cdn.vatix.store
VARS
trap 'rm -f "$ENV_FILE"' EXIT INT TERM
npx expo start --clear "$@"
