/**
 * One-shot data migration: copies all rows from OLD_DB → NEW_DB.
 * Truncates each table in the new DB first (in FK-safe order), then
 * bulk-inserts all rows from the old DB.
 *
 * Usage:
 *   OLD_DB="<old connection string>" NEW_DB="<new connection string>" node migrate-db.mjs
 */

import pg from "pg";
const { Client } = pg;

const OLD_DB =
  process.env.OLD_DB ||
  "postgresql://neondb_owner:npg_TcjEL6WmsG4v@ep-holy-moon-aoy706db.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const NEW_DB =
  process.env.NEW_DB ||
  "postgresql://neondb_owner:npg_7EdgjrNyBHe3@ep-misty-math-azh5hyws.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// Tables in a safe truncation order (leaf tables first to avoid FK violations)
const TABLES = [
  "bigquery_sync_status",
  "support_messages",
  "support_conversations",
  "contact_us_messages",
  "dashboard_analytics_events",
  "dashboard_feedback",
  "forms_auth_tokens",
  "slot_bookings",
  "slot_notify_requests",
  "assessment_slots",
  "practice_sessions",
  "student_activity",
  "weekly_activity",
  "subject_progress",
  "student_marks",
  "academy_user_assessment_details",
  "academy_user_course_progress",
  "academy_user_nxtmock_details",
  "academy_user_basic_details",
  "l1_cycle_registrations",
  "l1_exam_access",
  "blocked_users",
  "unpaid_users",
  "visibility_settings",
  "students",
];

const BATCH_SIZE = 500;

async function main() {
  const src = new Client({ connectionString: OLD_DB });
  const dst = new Client({ connectionString: NEW_DB });

  await src.connect();
  await dst.connect();
  console.log("Connected to both databases.");

  // Disable FK checks during load
  await dst.query("SET session_replication_role = replica;");

  for (const table of TABLES) {
    process.stdout.write(`Migrating ${table} … `);
    const { rows } = await src.query(`SELECT * FROM "${table}"`);
    if (rows.length === 0) {
      console.log("0 rows, skipping.");
      continue;
    }

    await dst.query(`TRUNCATE TABLE "${table}" CASCADE`);

    const columns = Object.keys(rows[0]);
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const values = [];
      const placeholders = batch.map((row, rowIdx) => {
        const rowPlaceholders = columns.map((_, colIdx) => {
          values.push(row[columns[colIdx]]);
          return `$${rowIdx * columns.length + colIdx + 1}`;
        });
        return `(${rowPlaceholders.join(", ")})`;
      });

      const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES ${placeholders.join(", ")}`;
      await dst.query(sql, values);
      inserted += batch.length;
    }

    console.log(`${inserted} rows copied.`);
  }

  await dst.query("SET session_replication_role = DEFAULT;");
  await src.end();
  await dst.end();
  console.log("\n✅ Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
