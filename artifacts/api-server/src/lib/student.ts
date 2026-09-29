import {
  db,
  studentsTable,
  academyUserAssessmentDetailsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  getAcademyUserBasicDetails,
  resolveAcademyUserDisplayName,
  sanitizeProfilePicUrl,
} from "./academyUserProfile";

/** Used only when the POCs mirror has no YOG for the user yet. */
const DEFAULT_YOG = 2028;

/**
 * Each SSO user is mapped to exactly one `students` row, keyed by a synthetic
 * email derived from their academy user_id. This keeps journey state,
 * onboarding, and per-user flags isolated between students.
 */
export function emailForUser(userId: string): string {
  return `${userId}@academy.local`;
}

/** A user only gets dashboard access if they appear in the synced assessment data. */
export async function userHasAssessmentData(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: academyUserAssessmentDetailsTable.id })
    .from(academyUserAssessmentDetailsTable)
    .where(eq(academyUserAssessmentDetailsTable.userId, userId))
    .limit(1);
  return Boolean(row);
}

export async function getStudentForUser(userId: string) {
  const [existing] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, emailForUser(userId)))
    .limit(1);
  return existing ?? null;
}

/**
 * Returns this user's `students` row, creating one on first access. New rows
 * start onboarded on the standard L1 path so students land directly on their
 * own dashboard.
 */
async function insertStudent(userId: string, name: string, yog: number, avatar: string) {
  const [created] = await db
    .insert(studentsTable)
    .values({
      name,
      yog,
      avatar,
      email: emailForUser(userId),
      journeyState: "L1_PREP",
      hasCompletedOnboarding: 1,
    })
    .onConflictDoNothing({ target: studentsTable.email })
    .returning();
  return created ?? null;
}

/** Resync the serial id sequence with the table's max id. */
async function realignStudentIdSequence() {
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('students', 'id'), (SELECT COALESCE(MAX(id), 1) FROM students), true)`,
  );
}

export async function getOrCreateStudentForUser(userId: string) {
  const existing = await getStudentForUser(userId);
  if (existing) return existing;

  // Seed identity from the BigQuery POCs mirror (name on certificate, YOG, pic).
  const basic = await getAcademyUserBasicDetails(userId);
  const name = resolveAcademyUserDisplayName(basic) ?? "Student";
  const yog = basic?.yog ?? DEFAULT_YOG;
  const avatar = sanitizeProfilePicUrl(basic?.profilePicUrl);

  try {
    const created = await insertStudent(userId, name, yog, avatar);
    if (created) return created;
  } catch (err) {
    // A stale serial sequence (e.g. legacy rows inserted with explicit ids)
    // can collide on the primary key. Realign the sequence and retry once.
    // Drizzle wraps the underlying PG error, so we check the full error chain.
    const fullText = [
      err instanceof Error ? err.message : String(err),
      err instanceof Error && err.cause instanceof Error ? err.cause.message : "",
    ].join(" ");
    if (!fullText.includes("students_pkey")) throw err;
    await realignStudentIdSequence();
    const created = await insertStudent(userId, name, yog, avatar);
    if (created) return created;
  }

  return getStudentForUser(userId);
}
