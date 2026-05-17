#!/usr/bin/env bash
# Migrate PostgreSQL data between Cloud SQL instances using Cloud SQL Auth Proxy.
#
# Use this when you need to move data to a new Cloud SQL instance
# (e.g., after recreating the instance via Terraform).
#
# Prerequisites:
#   - gcloud CLI authenticated with Cloud SQL Admin permissions
#   - cloud-sql-proxy binary in PATH (https://cloud.google.com/sql/docs/postgres/sql-proxy)
#   - pg_dump / psql installed locally
#
# Usage:
#   ./scripts/migrate_db.sh \
#     --source-instance gen-lang-client-0698668474:europe-west1:querypal-db \
#     --target-instance gen-lang-client-0698668474:europe-west1:querypal-db-new \
#     --db-name querypal \
#     --db-user postgres
#
# The script will prompt for the database password interactively.

set -euo pipefail

# ── Argument parsing ─────────────────────────────────────────────────────────

SOURCE_INSTANCE=""
TARGET_INSTANCE=""
DB_NAME="querypal"
DB_USER="postgres"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-instance) SOURCE_INSTANCE="$2"; shift 2 ;;
    --target-instance) TARGET_INSTANCE="$2"; shift 2 ;;
    --db-name)         DB_NAME="$2";         shift 2 ;;
    --db-user)         DB_USER="$2";         shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SOURCE_INSTANCE" || -z "$TARGET_INSTANCE" ]]; then
  echo "Usage: $0 --source-instance CONN_NAME --target-instance CONN_NAME [--db-name NAME] [--db-user USER]" >&2
  exit 1
fi

# ── Setup ────────────────────────────────────────────────────────────────────

SOURCE_PORT=5432
TARGET_PORT=5433
DUMP_FILE="$(mktemp /tmp/querypal_dump_XXXXXX.sql)"
SOURCE_PROXY_PID=""
TARGET_PROXY_PID=""

cleanup() {
  echo "==> Cleaning up..."
  [[ -n "$SOURCE_PROXY_PID" ]] && kill "$SOURCE_PROXY_PID" 2>/dev/null || true
  [[ -n "$TARGET_PROXY_PID" ]] && kill "$TARGET_PROXY_PID" 2>/dev/null || true
  rm -f "$DUMP_FILE"
}
trap cleanup EXIT

echo "==> Migration plan:"
echo "    Source:   ${SOURCE_INSTANCE} (port ${SOURCE_PORT})"
echo "    Target:   ${TARGET_INSTANCE} (port ${TARGET_PORT})"
echo "    Database: ${DB_NAME}"
echo ""
read -rsp "Enter database password for '${DB_USER}': " DB_PASS
echo ""
export PGPASSWORD="$DB_PASS"

# ── Start Cloud SQL Auth Proxy ───────────────────────────────────────────────

echo "==> Starting Cloud SQL Auth Proxy for source instance..."
cloud-sql-proxy \
  "${SOURCE_INSTANCE}?port=${SOURCE_PORT}" \
  --quiet &
SOURCE_PROXY_PID=$!

echo "==> Starting Cloud SQL Auth Proxy for target instance..."
cloud-sql-proxy \
  "${TARGET_INSTANCE}?port=${TARGET_PORT}" \
  --quiet &
TARGET_PROXY_PID=$!

# Wait for proxies to be ready.
sleep 3

# ── Dump source ──────────────────────────────────────────────────────────────

echo "==> Dumping source database to ${DUMP_FILE}..."
pg_dump \
  --host=127.0.0.1 \
  --port="${SOURCE_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-acl \
  --file="${DUMP_FILE}"

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
echo "    Dump complete: ${DUMP_SIZE}"

# ── Restore to target ────────────────────────────────────────────────────────

echo "==> Restoring to target database..."
# Drop and recreate schema to ensure a clean slate.
psql \
  --host=127.0.0.1 \
  --port="${TARGET_PORT}" \
  --username="${DB_USER}" \
  --dbname=postgres \
  --command="DROP DATABASE IF EXISTS ${DB_NAME};"

psql \
  --host=127.0.0.1 \
  --port="${TARGET_PORT}" \
  --username="${DB_USER}" \
  --dbname=postgres \
  --command="CREATE DATABASE ${DB_NAME};"

psql \
  --host=127.0.0.1 \
  --port="${TARGET_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --file="${DUMP_FILE}"

echo ""
echo "==> Migration complete."
echo "    Verify the target database before updating DB_UNIX_SOCKET in Cloud Run."
