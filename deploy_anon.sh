#!/usr/bin/env bash
set -euo pipefail

# C64 whiteboard + PHP backend deploy helper
# Usage: bash deploy_anon.sh

echo "=== Deploy C64 whiteboard to anon.p2p.pm (or another host) ==="

DEFAULT_HOST="anon.p2p.pm"

read -rp "SSH user (e.g. anon): " SSH_USER
read -rp "SSH host [${DEFAULT_HOST}]: " SSH_HOST
SSH_HOST=${SSH_HOST:-$DEFAULT_HOST}
read -rp "Remote webroot (e.g. /var/www/anon.p2p.pm): " WEBROOT

if [[ -z "${SSH_USER}" || -z "${SSH_HOST}" || -z "${WEBROOT}" ]]; then
  echo "[ERROR] SSH user, host, and webroot are all required." >&2
  exit 1
fi

echo
echo "Checking required tools..."
for bin in npm rsync ssh; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[ERROR] Required command '$bin' not found in PATH." >&2
    exit 1
  fi
done

echo
if [[ ! -d node_modules ]]; then
  read -rp "node_modules not found. Run 'npm install' now? [Y/n] " INSTALL
  INSTALL=${INSTALL:-Y}
  if [[ "${INSTALL,,}" == "y" ]]; then
    echo "Running npm install..."
    npm install
  else
    echo "Skipping npm install (make sure dependencies are already installed)."
  fi
fi

echo
echo "Building production bundle with 'npm run build'..."
npm run build

echo
if [[ ! -d dist ]]; then
  echo "[ERROR] Build output directory 'dist/' not found. Did 'npm run build' succeed?" >&2
  exit 1
fi

if [[ ! -d api ]]; then
  echo "[WARNING] 'api/' directory not found. PHP endpoints will not be deployed."
fi

echo "About to deploy to: ${SSH_USER}@${SSH_HOST}:${WEBROOT}"
echo "Will rsync:"
echo "  - dist/ -> ${WEBROOT}/"
if [[ -d api ]]; then
  echo "  - api/  -> ${WEBROOT}/api/"
fi
read -rp "Proceed with rsync deploy? [y/N] " CONFIRM
CONFIRM=${CONFIRM:-N}
if [[ "${CONFIRM,,}" != "y" ]]; then
  echo "Deployment cancelled."
  exit 0
fi

echo
echo "Syncing frontend (dist/)..."
rsync -av --delete dist/ "${SSH_USER}@${SSH_HOST}:${WEBROOT}/"

if [[ -d api ]]; then
  echo
  echo "Syncing PHP API (api/)..."
  rsync -av api/ "${SSH_USER}@${SSH_HOST}:${WEBROOT}/api/"
fi

echo
read -rp "Run a quick remote 'ls' of the webroot to verify deployment? [Y/n] " VERIFY
VERIFY=${VERIFY:-Y}
if [[ "${VERIFY,,}" == "y" ]]; then
  echo
  ssh "${SSH_USER}@${SSH_HOST}" "ls -al '${WEBROOT}'" || true
fi

cat <<EOF

=== Deployment finished ===
- Frontend built with 'npm run build' and uploaded from ./dist
- PHP API (if present) uploaded from ./api

Next steps (manual on server if needed):
- Ensure correct ownership, e.g.: sudo chown -R www-data:www-data '${WEBROOT}'
- Ensure correct permissions, e.g.: sudo chmod -R 775 '${WEBROOT}'
- Confirm site + /api endpoints work in a browser on anon.p2p.pm
EOF
