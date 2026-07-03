import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pg = require("../../lib/db/node_modules/pg");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(root, ".env");

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const csvArg = args.find((a) => !a.startsWith("--"));
const csvPath =
  csvArg ?? "/Users/sravankumarega/Downloads/IRP Stats sheet - sample (1).csv";

if (!existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sentinel value used to mark rows inserted purely to grant dashboard access.
// A user without any real assessment data will only have this row, which
// unlocks userHasAssessmentData() without polluting score-picking logic
// (assessmentTitle/level/tag/scores are all null so it's ignored by
// isL1OnlineAssessment / isFeProjectAssessment).
const SENTINEL = "manual-access-grant";

const raw = readFileSync(csvPath, "utf8");
const lines = raw.split(/\r?\n/);

const ids = new Set();
const invalid = [];
for (let i = 0; i < lines.length; i++) {
  const cell = (lines[i] ?? "").split(",")[0]?.trim();
  if (!cell) continue;
  if (cell.toLowerCase() === "user_id") continue; // header
  if (!UUID_RE.test(cell)) {
    invalid.push({ line: i + 1, value: cell });
    continue;
  }
  ids.add(cell.toLowerCase());
}

const userIds = [...ids];
console.log(
  JSON.stringify(
    {
      csv: csvPath,
      totalLines: lines.length,
      uniqueUserIds: userIds.length,
      invalidRows: invalid.length,
      firstInvalid: invalid.slice(0, 3),
    },
    null,
    2,
  ),
);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  // 1. How many of these users already have ANY assessment row (already enrolled)?
  const alreadyEnrolledRes = await pool.query(
    `SELECT DISTINCT user_id FROM academy_user_assessment_details WHERE user_id = ANY($1::text[])`,
    [userIds],
  );
  const alreadyEnrolled = new Set(alreadyEnrolledRes.rows.map((r) => r.user_id));

  // 2. How many already have the sentinel row (previous manual grant)?
  const alreadyGrantedRes = await pool.query(
    `SELECT user_id FROM academy_user_assessment_details
      WHERE user_id = ANY($1::text[]) AND organisation_assessment_id = $2`,
    [userIds, SENTINEL],
  );
  const alreadyGranted = new Set(alreadyGrantedRes.rows.map((r) => r.user_id));

  const targets = userIds.filter((id) => !alreadyEnrolled.has(id));

  console.log(
    JSON.stringify(
      {
        alreadyEnrolled: alreadyEnrolled.size,
        alreadyGrantedViaSentinel: alreadyGranted.size,
        needsGrant: targets.length,
        dryRun,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry run — no writes performed.");
    await pool.end();
    process.exit(0);
  }

  // 3. Batch insert placeholder rows.
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const chunk = targets.slice(i, i + BATCH);
    const values = [];
    const params = [];
    chunk.forEach((uid, idx) => {
      const p = idx * 2;
      values.push(`($${p + 1}, $${p + 2}, NOW())`);
      params.push(uid, SENTINEL);
    });
    const sql = `INSERT INTO academy_user_assessment_details
        (user_id, organisation_assessment_id, synced_at)
      VALUES ${values.join(",")}
      ON CONFLICT (user_id, organisation_assessment_id) DO NOTHING`;
    const res = await pool.query(sql, params);
    inserted += res.rowCount ?? 0;
    if ((i / BATCH) % 4 === 0) {
      console.log(`  inserted ${inserted}/${targets.length}…`);
    }
  }

  // 4. Final verification.
  const finalRes = await pool.query(
    `SELECT COUNT(DISTINCT user_id)::int AS enrolled
       FROM academy_user_assessment_details
      WHERE user_id = ANY($1::text[])`,
    [userIds],
  );

  console.log(
    JSON.stringify(
      {
        inserted,
        totalEnrolledInList: finalRes.rows[0].enrolled,
        totalIds: userIds.length,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
