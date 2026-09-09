#!/usr/bin/env bash
# Daily BigQuery → Neon sync against DATABASE_URL from repo .env
# launchd uses ~/Library/Application Support/irp-bq-sync/daily-bq-sync.sh
# (outside Downloads) so macOS TCC does not block the 10:00 job.
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${HOME}/Library/Logs/irp-bq-sync"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/sync-$(date +%Y%m%d).log"

exec >>"$LOG_FILE" 2>&1
echo "==== $(date '+%Y-%m-%dT%H:%M:%S%z') starting BQ sync ===="

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: missing $ROOT/.env"
  exit 1
fi

# Load .env safely (do not `source` — keys/values may have spaces).
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" != *=* ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  key="${key%"${key##*[![:space:]]}"}"
  key="${key#"${key%%[![:space:]]*}"}"
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  if [[ ${#value} -ge 2 ]]; then
    first="${value:0:1}"
    last="${value: -1}"
    if [[ ( "$first" == '"' && "$last" == '"' ) || ( "$first" == "'" && "$last" == "'" ) ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi
  export "$key=$value"
done < .env

export BQ_DATASET="${BQ_DATASET:-academy_student_success_pocs}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set in .env"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found on PATH=$PATH"
  exit 1
fi

# After pg_dump/copy migrations, serial sequences can lag behind max(id) and
# cause duplicate-key failures on course_progress upserts. Fix before sync.
node --input-type=module <<'EOF'
import pg from "./lib/db/node_modules/pg/lib/index.js";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
for (const t of [
  "academy_user_course_progress",
  "academy_user_assessment_details",
  "academy_user_nxtmock_details",
]) {
  try {
    const { rows } = await pool.query(
      `select setval(pg_get_serial_sequence($1, 'id'), coalesce((select max(id) from ${t}), 1)) as next`,
      [t],
    );
    console.log(`seq ${t} -> ${rows[0].next}`);
  } catch (err) {
    console.warn(`seq skip ${t}:`, err?.message ?? err);
  }
}
await pool.end();
EOF

./scripts/node_modules/.bin/tsx ./scripts/src/sync-bigquery.ts
echo "==== $(date '+%Y-%m-%dT%H:%M:%S%z') finished ===="
