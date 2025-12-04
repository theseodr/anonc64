#!/usr/bin/env bash
set -euo pipefail

# C64 whiteboard + PHP backend deploy helper
# Usage: bash deploy_anon.sh

echo "=== Deploy C64 whiteboard (staging / production) ==="

# --- Environment selection -------------------------------------------------
echo "Select environment:"
echo "  [p] Production  (default)"
echo "  [s] Staging"
read -rp "Environment [p/s]: " ENV_CHOICE
ENV_CHOICE=${ENV_CHOICE:-p}

case "${ENV_CHOICE,,}" in
  s|staging)
    ENV_NAME="staging"
    DEFAULT_HOST="staging.anon.p2p.pm"
    DEFAULT_WEBROOT="/var/www/anon-staging"
    ;;
  *)
    ENV_NAME="production"
    DEFAULT_HOST="anon.p2p.pm"
    DEFAULT_WEBROOT="/var/www/anon.p2p.pm"
    ;;
esac

echo "Using ${ENV_NAME} defaults: host=${DEFAULT_HOST}, webroot=${DEFAULT_WEBROOT}"

read -rp "SSH user (e.g. anon): " SSH_USER
read -rp "SSH host [${DEFAULT_HOST}]: " SSH_HOST
SSH_HOST=${SSH_HOST:-$DEFAULT_HOST}
read -rp "Remote webroot [${DEFAULT_WEBROOT}]: " WEBROOT
WEBROOT=${WEBROOT:-$DEFAULT_WEBROOT}

if [[ -z "${SSH_USER}" || -z "${SSH_HOST}" || -z "${WEBROOT}" ]]; then
  echo "[ERROR] SSH user, host, and webroot are all required." >&2
  exit 1
fi

# HTTP base for health checks (can differ from SSH host)
read -rp "HTTP base URL for health check [https://${SSH_HOST}]: " HTTP_BASE
HTTP_BASE=${HTTP_BASE:-"https://${SSH_HOST}"}

echo
echo "Checking required tools..."
for bin in npm rsync ssh curl; do
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

echo "About to deploy to (${ENV_NAME}): ${SSH_USER}@${SSH_HOST}:${WEBROOT}"
echo "Will rsync (with backup before --delete):"
echo "  - dist/ -> ${WEBROOT}/"
if [[ -d api ]]; then
  echo "  - api/  -> ${WEBROOT}/api/"
fi
read -rp "Proceed with backup + rsync deploy? [y/N] " CONFIRM
CONFIRM=${CONFIRM:-N}
if [[ "${CONFIRM,,}" != "y" ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# --- Remote backup before rsync --delete -----------------------------------
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo
echo "Creating remote backup of current webroot (if it exists)..."
ssh "${SSH_USER}@${SSH_HOST}" "\
  if [ -d '${WEBROOT}' ]; then \
    BACKUP='${WEBROOT}_backup_${TIMESTAMP}.tar.gz'; \
    echo '  -> Archiving ${WEBROOT} to' \"\$BACKUP\"; \
    tar -czf \"\$BACKUP\" -C '/' '${WEBROOT#/}'; \
  else \
    echo '  -> No existing webroot at ${WEBROOT}, skipping backup.'; \
  fi
" || {
  echo "[WARNING] Remote backup step failed (continuing with deploy)." >&2
}

# --- Rsync deployment ------------------------------------------------------
echo
echo "Syncing frontend (dist/)..."
rsync -av --delete dist/ "${SSH_USER}@${SSH_HOST}:${WEBROOT}/"

if [[ -d api ]]; then
  echo
  echo "Syncing PHP API (api/)..."
  rsync -av api/ "${SSH_USER}@${SSH_HOST}:${WEBROOT}/api/"
fi

# --- Optional remote ls ----------------------------------------------------
echo
read -rp "Run a quick remote 'ls' of the webroot to verify deployment? [Y/n] " VERIFY
VERIFY=${VERIFY:-Y}
if [[ "${VERIFY,,}" == "y" ]]; then
  echo
  ssh "${SSH_USER}@${SSH_HOST}" "ls -al '${WEBROOT}'" || true
fi

# --- HTTP health checks ----------------------------------------------------
echo
echo "Running HTTP health checks against: ${HTTP_BASE}"
HEALTH_OK=true

if curl -fsS "${HTTP_BASE}/" >/dev/null; then
  echo "[OK] Front page (${HTTP_BASE}/) reachable."
else
  echo "[FAIL] Front page (${HTTP_BASE}/) NOT reachable."
  HEALTH_OK=false
fi

if curl -fsS "${HTTP_BASE}/api/list_strokes.php" >/dev/null; then
  echo "[OK] API /api/list_strokes.php reachable."
else
  echo "[FAIL] API /api/list_strokes.php NOT reachable."
  HEALTH_OK=false
fi

if curl -fsS "${HTTP_BASE}/api/list_messages.php" >/dev/null; then
  echo "[OK] API /api/list_messages.php reachable."
else
  echo "[FAIL] API /api/list_messages.php NOT reachable."
  HEALTH_OK=false
fi

cat <<EOF

=== Deployment finished (${ENV_NAME}) ===
- Frontend built with 'npm run build' and uploaded from ./dist
- PHP API (if present) uploaded from ./api
EOF

if [[ "${HEALTH_OK}" == true ]]; then
  echo "- All HTTP health checks PASSED for ${HTTP_BASE}."
  exit 0
else
  echo "- Some HTTP health checks FAILED for ${HTTP_BASE}. Inspect logs or try curl manually."
  exit 1
fi
