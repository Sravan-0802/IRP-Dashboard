#!/usr/bin/env bash
# Daily BigQuery → Neon sync against DATABASE_URL from repo .env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${HOME}/Library/Logs/irp-bq-sync"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/sync-$(date +%Y%m%d).log"

exec >>"$LOG_FILE" 2>&1
echo "==== $(date -Is) starting BQ sync ===="

cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: missing $ROOT/.env"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

export BQ_DATASET="${BQ_DATASET:-academy_student_success_pocs}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set in .env"
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
echo "==== $(date -Is) finished ===="
