import { Router } from "express";
import {
  db,
  studentsTable,
  academyUserBasicDetailsTable,
  academyUserAssessmentDetailsTable,
  l1CycleRegistrationsTable,
  l1ExamAccessTable,
  unpaidUsersTable,
  blockedUsersTable,
  dashboardAnalyticsEventsTable,
} from "@workspace/db";
import { inArray, eq, and, sql } from "drizzle-orm";
import { checkApiKey } from "../lib/apiKey";
import { emailForUser } from "../lib/student";
import {
  getVisibilitySettings,
  parseAdminSettingsBody,
  toResponse,
  updateVisibilitySettings,
} from "../lib/visibilitySettings";
import {
  getGenAiTrainingPopup,
  parseGenAiTrainingPopupBody,
  updateGenAiTrainingPopup,
} from "../lib/genAiTrainingPopup";
import { getProgramBoard, parseProgramBoardBody, updateProgramBoard } from "../lib/programBoard";
import {
  getFeQualificationRules,
  parseFeQualificationRules,
  updateFeQualificationRules,
} from "../lib/feQualificationRules";
import {
  getGenaiQualificationRules,
  parseGenaiQualificationRules,
  updateGenaiQualificationRules,
} from "../lib/genaiQualificationRules";
import { getGenaiAssessmentSummary } from "../lib/genaiResults";
import { getFeAssessmentSummary } from "../lib/feSummary";
import {
  getL1QualificationRules,
  parseL1QualificationRules,
  updateL1QualificationRules,
} from "../lib/l1QualificationRules";
import { getL1AssessmentSummary } from "../lib/l1Summary";
import { listAuthCodeLogs } from "../lib/authCodeLog";
import { runGenaiBigQuerySync } from "../lib/sync-bigquery";
import { createAuthToken } from "../lib/authTokens";
import {
  MANUAL_DASHBOARD_ACCESS_GRANT_ID,
  MANUAL_DASHBOARD_ACCESS_REVOKE_ID,
  resolveAcademyUserDisplayName,
} from "../lib/academyUserProfile";

const router = Router();

const PREVIEW_TOKEN_TTL_MINUTES = Number(process.env["FORMS_TOKEN_TTL_MINUTES"]) || 15;

// POST /api/admin/students/fe-project-done — mark a batch of academy users as
// having cleared L1 and completed their FE Project (admin API key required).
// Body: { academyUserIds: string[] }
router.post("/admin/students/fe-project-done", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    // Only act on enrolled users (those present in the synced assessment data).
    const enrolledRows = await db
      .select({ userId: academyUserAssessmentDetailsTable.userId })
      .from(academyUserAssessmentDetailsTable)
      .where(inArray(academyUserAssessmentDetailsTable.userId, academyUserIds));
    const enrolled = new Set(enrolledRows.map((r) => r.userId));
    const skipped = academyUserIds.filter((id) => !enrolled.has(id));
    const targets = academyUserIds.filter((id) => enrolled.has(id));

    // Resolve names for any rows we may need to create.
    const basicRows = targets.length
      ? await db
          .select({
            userId: academyUserBasicDetailsTable.userId,
            userName: academyUserBasicDetailsTable.userName,
            firstName: academyUserBasicDetailsTable.firstName,
            lastName: academyUserBasicDetailsTable.lastName,
            nameOnCertificate: academyUserBasicDetailsTable.nameOnCertificate,
          })
          .from(academyUserBasicDetailsTable)
          .where(inArray(academyUserBasicDetailsTable.userId, targets))
      : [];
    const nameMap = new Map(
      basicRows.map((r) => [r.userId, resolveAcademyUserDisplayName(r)] as const),
    );

    const updated: string[] = [];
    for (const userId of targets) {
      await db
        .insert(studentsTable)
        .values({
          name: nameMap.get(userId) ?? "Student",
          yog: 2028,
          email: emailForUser(userId),
          journeyState: "L1_POST_ASSESSMENT",
          projectSubmitted: 1,
          hasAttemptedL1: 1,
          hasCompletedOnboarding: 1,
        })
        .onConflictDoUpdate({
          target: studentsTable.email,
          set: {
            journeyState: "L1_POST_ASSESSMENT",
            projectSubmitted: 1,
            hasAttemptedL1: 1,
            hasCompletedOnboarding: 1,
          },
        });
      updated.push(userId);
    }

    res.json({
      requested: academyUserIds.length,
      updated: updated.length,
      updatedIds: updated,
      skipped,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to mark FE project done");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/students/ai-mock-cleared — mark a batch of academy users as
// having cleared the AI Mock Interview (admin API key required).
// Body: { academyUserIds: string[] }
router.post("/admin/students/ai-mock-cleared", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const enrolledRows = await db
      .select({ userId: academyUserAssessmentDetailsTable.userId })
      .from(academyUserAssessmentDetailsTable)
      .where(inArray(academyUserAssessmentDetailsTable.userId, academyUserIds));
    const enrolled = new Set(enrolledRows.map((r) => r.userId));
    const skipped = academyUserIds.filter((id) => !enrolled.has(id));
    const targets = academyUserIds.filter((id) => enrolled.has(id));

    const basicRows = targets.length
      ? await db
          .select({
            userId: academyUserBasicDetailsTable.userId,
            userName: academyUserBasicDetailsTable.userName,
            firstName: academyUserBasicDetailsTable.firstName,
            lastName: academyUserBasicDetailsTable.lastName,
            nameOnCertificate: academyUserBasicDetailsTable.nameOnCertificate,
          })
          .from(academyUserBasicDetailsTable)
          .where(inArray(academyUserBasicDetailsTable.userId, targets))
      : [];
    const nameMap = new Map(
      basicRows.map((r) => [r.userId, resolveAcademyUserDisplayName(r)] as const),
    );

    const updated: string[] = [];
    for (const userId of targets) {
      await db
        .insert(studentsTable)
        .values({
          name: nameMap.get(userId) ?? "Student",
          yog: 2028,
          email: emailForUser(userId),
          journeyState: "L1_HUMAN_INTERVIEW",
          projectSubmitted: 1,
          hasAttemptedL1: 1,
          hasCompletedOnboarding: 1,
        })
        .onConflictDoUpdate({
          target: studentsTable.email,
          set: {
            journeyState: "L1_HUMAN_INTERVIEW",
            projectSubmitted: 1,
            hasAttemptedL1: 1,
            hasCompletedOnboarding: 1,
          },
        });
      updated.push(userId);
    }

    res.json({
      requested: academyUserIds.length,
      updated: updated.length,
      updatedIds: updated,
      skipped,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to mark AI mock cleared");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/students/reset-l1-registration — delete a student's L1 cycle
// registration so they can re-register with a different slot (admin key required).
// Body: { academyUserId: string, cycle?: number }
router.post("/admin/students/reset-l1-registration", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const academyUserId = String(req.body?.academyUserId ?? "").trim();
    if (!academyUserId) {
      res.status(400).json({ error: "academyUserId is required" });
      return;
    }
    const cycle = Number(req.body?.cycle ?? 2);
    const deleted = await db
      .delete(l1CycleRegistrationsTable)
      .where(
        and(
          eq(l1CycleRegistrationsTable.academyUserId, academyUserId),
          eq(l1CycleRegistrationsTable.cycle, cycle),
        ),
      )
      .returning({ id: l1CycleRegistrationsTable.id });
    res.json({ reset: deleted.length > 0, deletedRows: deleted.length, academyUserId, cycle });
  } catch (err) {
    req.log.error({ err }, "Failed to reset L1 registration");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/l1-exam-access/import — bulk upsert the authoritative
// exam-platform slot mapping (admin API key required). This is the source of
// truth for which slot's MAIN assessment link each student sees.
// Body: { cycle?: number, entries: { academyUserId: string, slotId: "slot-1" | "slot-2" }[] }
router.post("/admin/l1-exam-access/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cycle = Number(req.body?.cycle ?? 2);
    if (!Number.isInteger(cycle) || cycle <= 0) {
      res.status(400).json({ error: "cycle must be a positive integer" });
      return;
    }

    const rawEntries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const ALLOWED_SLOTS = new Set(["slot-1", "slot-2", "slot-3"]);
    const seen = new Set<string>();
    const values: { academyUserId: string; cycle: number; slotId: string }[] = [];
    const invalid: unknown[] = [];

    for (const entry of rawEntries) {
      const academyUserId =
        entry && typeof entry === "object" && typeof entry.academyUserId === "string"
          ? entry.academyUserId.trim()
          : "";
      const slotId =
        entry && typeof entry === "object" && typeof entry.slotId === "string"
          ? entry.slotId.trim()
          : "";
      if (!academyUserId || !ALLOWED_SLOTS.has(slotId) || seen.has(academyUserId)) {
        if (!academyUserId || !ALLOWED_SLOTS.has(slotId)) invalid.push(entry);
        continue;
      }
      seen.add(academyUserId);
      values.push({ academyUserId, cycle, slotId });
    }

    if (values.length === 0) {
      res.status(400).json({ error: "entries must contain at least one valid { academyUserId, slotId }", invalid: invalid.length });
      return;
    }

    const now = new Date();
    let upserted = 0;
    // Chunk to keep parameter counts well under Postgres limits.
    const CHUNK = 500;
    for (let i = 0; i < values.length; i += CHUNK) {
      const chunk = values.slice(i, i + CHUNK).map((v) => ({ ...v, createdAt: now, updatedAt: now }));
      const rows = await db
        .insert(l1ExamAccessTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: [l1ExamAccessTable.academyUserId, l1ExamAccessTable.cycle],
          set: { slotId: sql`excluded.slot_id`, updatedAt: now },
        })
        .returning({ id: l1ExamAccessTable.id });
      upserted += rows.length;
    }

    res.json({ requested: rawEntries.length, upserted, invalid: invalid.length });
  } catch (err) {
    req.log.error({ err }, "Failed to import L1 exam access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/unpaid-users/import — set the list of unpaid users who are
// gated behind the "complete your payment" prompt (admin API key required).
// Body: { academyUserIds: string[], replace?: boolean }
// When replace=true the existing list is cleared first, so the payload becomes
// the authoritative set of unpaid users.
router.post("/admin/unpaid-users/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const replace = req.body?.replace === true;
    const now = new Date();

    // Run clear + insert in a single transaction so a mid-import failure can
    // never leave the payment gate in a partial state.
    let inserted = 0;
    const CHUNK = 500;
    await db.transaction(async (tx) => {
      if (replace) {
        await tx.delete(unpaidUsersTable);
      }
      for (let i = 0; i < academyUserIds.length; i += CHUNK) {
        const chunk = academyUserIds
          .slice(i, i + CHUNK)
          .map((academyUserId) => ({ academyUserId, createdAt: now }));
        const rows = await tx
          .insert(unpaidUsersTable)
          .values(chunk)
          .onConflictDoNothing({ target: unpaidUsersTable.academyUserId })
          .returning({ academyUserId: unpaidUsersTable.academyUserId });
        inserted += rows.length;
      }
    });

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(unpaidUsersTable);

    res.json({ requested: academyUserIds.length, inserted, total: count });
  } catch (err) {
    req.log.error({ err }, "Failed to import unpaid users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/unpaid-users/:academyUserId — mark one user unpaid (payment gate)
// or paid (remove from unpaid list). Admin API key required.
// Body: { unpaid: boolean }
router.put("/admin/unpaid-users/:academyUserId", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const academyUserId = String(req.params.academyUserId ?? "").trim();
    if (!academyUserId) {
      res.status(400).json({ error: "academyUserId is required" });
      return;
    }

    const unpaid = (req.body as { unpaid?: unknown })?.unpaid;
    if (typeof unpaid !== "boolean") {
      res.status(400).json({ error: "Body must include unpaid: true | false" });
      return;
    }

    if (unpaid) {
      await db
        .insert(unpaidUsersTable)
        .values({ academyUserId, createdAt: new Date() })
        .onConflictDoNothing({ target: unpaidUsersTable.academyUserId });
    } else {
      await db
        .delete(unpaidUsersTable)
        .where(eq(unpaidUsersTable.academyUserId, academyUserId));
    }

    res.json({ ok: true, academyUserId, paid: !unpaid, unpaid });
  } catch (err) {
    req.log.error({ err }, "Failed to update unpaid user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/dashboard-access/summary — current dashboard eligibility and
// payment-gate counts from the BigQuery assessment mirror.
router.get("/admin/dashboard-access/summary", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const result = await db.execute(sql`
      WITH people AS (
        SELECT
          user_id,
          yog,
          UPPER(REGEXP_REPLACE(BTRIM(COALESCE(payment_status, '')), '[[:space:]-]+', '_', 'g')) AS payment_raw,
          UPPER(REGEXP_REPLACE(BTRIM(COALESCE(irp_eligible_status, '')), '[[:space:]-]+', '_', 'g')) AS irp_raw
        FROM academy_user_basic_details
        WHERE user_id IS NOT NULL
          AND BTRIM(user_id) <> ''
      ),
      norm AS (
        SELECT
          user_id,
          yog,
          CASE
            WHEN payment_raw IN ('NOT_PAID', 'PAYMENT_UNPAID') THEN 'UNPAID'
            WHEN payment_raw IN ('PAYMENT_PAID', 'FULLY_PAID') THEN 'PAID'
            WHEN payment_raw IN ('PARTIAL', 'PARTIAL_PAID') THEN 'PARTIALLY_PAID'
            WHEN payment_raw = '' THEN NULL
            ELSE payment_raw
          END AS payment_status,
          NULLIF(irp_raw, '') AS irp_status
        FROM people
      ),
      grants AS (
        SELECT
          user_id,
          bool_or(organisation_assessment_id = 'manual-access-grant') AS granted
        FROM academy_user_assessment_details
        WHERE organisation_assessment_id = 'manual-access-grant'
        GROUP BY user_id
      ),
      sync AS (
        SELECT status, last_synced_at
        FROM bigquery_sync_status
        WHERE table_name IN ('academy_user_basic_details', 'academy_user_assessment_details')
        ORDER BY last_synced_at DESC NULLS LAST
        LIMIT 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM academy_user_assessment_details) AS assessment_rows,
        COUNT(*) FILTER (WHERE irp_status = 'ELIGIBLE')::int AS eligible_users,
        COUNT(*) FILTER (WHERE payment_status IN ('UNPAID', 'PARTIALLY_PAID'))::int AS unpaid_users_total,
        COUNT(*) FILTER (
          WHERE irp_status = 'ELIGIBLE'
            AND (payment_status IS NULL OR payment_status NOT IN ('UNPAID', 'PARTIALLY_PAID'))
        )::int AS paid_dashboard_users,
        -- Unpaid rows are all NOT_ELIGIBLE in this mirror, so eligible+unpaid is empty.
        -- Yet-to-pay is the eligible group that has not paid in full. The access gate
        -- still lets them in (NBFC / instalments).
        COUNT(*) FILTER (
          WHERE irp_status = 'ELIGIBLE'
            AND payment_status = 'YET_TO_PAY'
        )::int AS eligible_yet_to_pay,
        COUNT(*) FILTER (
          WHERE irp_status = 'ELIGIBLE'
            AND yog IN (2028, 2029, 2030)
        )::int AS yog_cohort_eligible,
        COUNT(*) FILTER (WHERE irp_status = 'ELIGIBLE' AND yog = 2028)::int AS eligible_2028,
        COUNT(*) FILTER (WHERE irp_status = 'ELIGIBLE' AND yog = 2029)::int AS eligible_2029,
        COUNT(*) FILTER (WHERE irp_status = 'ELIGIBLE' AND yog = 2030)::int AS eligible_2030,
        COUNT(*) FILTER (
          WHERE irp_status = 'ELIGIBLE'
            AND yog IN (2028, 2029, 2030)
            AND grants.granted IS TRUE
        )::int AS yog_cohort_access,
        COUNT(*) FILTER (
          WHERE irp_status = 'ELIGIBLE'
            AND payment_status IN ('UNPAID', 'PARTIALLY_PAID')
        )::int AS unpaid_eligible_users,
        (SELECT status FROM sync) AS sync_status,
        (SELECT last_synced_at FROM sync) AS last_synced_at
      FROM norm
      LEFT JOIN grants ON grants.user_id = norm.user_id
    `);

    const row = ((result as { rows?: Record<string, unknown>[] }).rows ?? [])[0] ?? {};
    const numberValue = (value: unknown) => Number(value ?? 0);

    res.json({
      assessmentRows: numberValue(row.assessment_rows),
      eligibleUsers: numberValue(row.eligible_users),
      unpaidUsersTotal: numberValue(row.unpaid_users_total),
      paidDashboardUsers: numberValue(row.paid_dashboard_users),
      eligibleYetToPay: numberValue(row.eligible_yet_to_pay),
      yogCohortEligible: numberValue(row.yog_cohort_eligible),
      eligible2028: numberValue(row.eligible_2028),
      eligible2029: numberValue(row.eligible_2029),
      eligible2030: numberValue(row.eligible_2030),
      yogCohortAccess: numberValue(row.yog_cohort_access),
      unpaidEligibleUsers: numberValue(row.unpaid_eligible_users),
      syncStatus: row.sync_status ?? null,
      lastSyncedAt: row.last_synced_at ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load dashboard access summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/dashboard-access/grant — explicitly grant dashboard access
// without modifying the synced payment/eligibility mirror. The sentinel row
// also makes userHasAssessmentData() pass for manually enrolled students.
// Body: { academyUserIds: string[] }
router.post("/admin/dashboard-access/grant", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v: unknown) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const now = new Date();
    const CHUNK = 500;
    let enrolledBasic = 0;
    let enrolledAssessment = 0;

    for (let i = 0; i < academyUserIds.length; i += CHUNK) {
      const chunk = academyUserIds.slice(i, i + CHUNK);

      const result = await db.transaction(async (tx) => {
        await tx
          .delete(unpaidUsersTable)
          .where(inArray(unpaidUsersTable.academyUserId, chunk));

        await tx
          .delete(academyUserAssessmentDetailsTable)
          .where(
            and(
              inArray(academyUserAssessmentDetailsTable.userId, chunk),
              eq(
                academyUserAssessmentDetailsTable.organisationAssessmentId,
                MANUAL_DASHBOARD_ACCESS_REVOKE_ID,
              ),
            ),
          );

        const basicRows = await tx
          .insert(academyUserBasicDetailsTable)
          .values(chunk.map((userId) => ({ userId, syncedAt: now })))
          .onConflictDoNothing({ target: academyUserBasicDetailsTable.userId })
          .returning({ userId: academyUserBasicDetailsTable.userId });

        const assessmentRows = await tx
          .insert(academyUserAssessmentDetailsTable)
          .values(
            chunk.map((userId) => ({
              userId,
              organisationAssessmentId: MANUAL_DASHBOARD_ACCESS_GRANT_ID,
              syncedAt: now,
            })),
          )
          .onConflictDoNothing()
          .returning({ id: academyUserAssessmentDetailsTable.id });

        return { basicRows, assessmentRows };
      });

      enrolledBasic += result.basicRows.length;
      enrolledAssessment += result.assessmentRows.length;
    }

    res.json({
      ok: true,
      requested: academyUserIds.length,
      manualAccessGranted: academyUserIds.length,
      enrolledBasic,
      enrolledAssessment,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to grant dashboard access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/dashboard-access/revoke — revoke manual dashboard access and
// explicitly deny dashboard entry, regardless of the synced payment status.
// Body: { academyUserIds: string[] }
router.post("/admin/dashboard-access/revoke", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v: unknown) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const now = new Date();
    const CHUNK = 500;
    let locked = 0;
    for (let i = 0; i < academyUserIds.length; i += CHUNK) {
      const academyUserIdChunk = academyUserIds.slice(i, i + CHUNK);
      const rows = await db.transaction(async (tx) => {
        await tx
          .delete(academyUserAssessmentDetailsTable)
          .where(
            and(
              inArray(academyUserAssessmentDetailsTable.userId, academyUserIdChunk),
              eq(
                academyUserAssessmentDetailsTable.organisationAssessmentId,
                MANUAL_DASHBOARD_ACCESS_GRANT_ID,
              ),
            ),
          );

        await tx
          .insert(academyUserAssessmentDetailsTable)
          .values(
            academyUserIdChunk.map((userId) => ({
              userId,
              organisationAssessmentId: MANUAL_DASHBOARD_ACCESS_REVOKE_ID,
              syncedAt: now,
            })),
          )
          .onConflictDoNothing();

        const unpaidRows = academyUserIdChunk.map((academyUserId) => ({
          academyUserId,
          createdAt: now,
        }));
        return tx
          .insert(unpaidUsersTable)
          .values(unpaidRows)
          .onConflictDoNothing({ target: unpaidUsersTable.academyUserId })
          .returning({ academyUserId: unpaidUsersTable.academyUserId });
      });
      locked += rows.length;
    }

    const [{ unpaidTotal } = { unpaidTotal: 0 }] = await db
      .select({ unpaidTotal: sql<number>`count(*)::int` })
      .from(unpaidUsersTable);

    res.json({
      ok: true,
      requested: academyUserIds.length,
      locked,
      alreadyUnpaid: academyUserIds.length - locked,
      unpaidTotal,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to revoke dashboard access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/blocked-users/import — fully deny access to a set of
// academy users (admin API key required). Once blocked, resolveAcademyUserId
// returns null for that user on every route — including a valid SSO token —
// so they are treated as fully logged out with no data ever returned.
// Body: { academyUserIds: string[], reason?: string }
router.post("/admin/blocked-users/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = req.body?.academyUserIds;
    const academyUserIds = Array.isArray(raw)
      ? [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
      : [];
    if (academyUserIds.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array" });
      return;
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() || null : null;
    const now = new Date();

    let upserted = 0;
    const CHUNK = 500;
    for (let i = 0; i < academyUserIds.length; i += CHUNK) {
      const chunk = academyUserIds
        .slice(i, i + CHUNK)
        .map((academyUserId) => ({ academyUserId, reason, createdAt: now }));
      const rows = await db
        .insert(blockedUsersTable)
        .values(chunk)
        .onConflictDoUpdate({
          target: blockedUsersTable.academyUserId,
          set: { reason },
        })
        .returning({ academyUserId: blockedUsersTable.academyUserId });
      upserted += rows.length;
    }

    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blockedUsersTable);

    res.json({ requested: academyUserIds.length, upserted, total: count });
  } catch (err) {
    req.log.error({ err }, "Failed to import blocked users");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/admin/blocked-users/:academyUserId — restore access for a
// previously blocked user (admin API key required).
router.delete("/admin/blocked-users/:academyUserId", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const academyUserId = req.params.academyUserId?.trim();
    if (!academyUserId) {
      res.status(400).json({ error: "academyUserId is required" });
      return;
    }

    const rows = await db
      .delete(blockedUsersTable)
      .where(eq(blockedUsersTable.academyUserId, academyUserId))
      .returning({ academyUserId: blockedUsersTable.academyUserId });

    res.json({ removed: rows.length > 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to remove blocked user");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/dashboard-access/import — grant dashboard access to a batch
// of academy users who have no assessment data yet (admin API key required).
// Inserts a minimal row into academy_user_basic_details and a placeholder row
// into academy_user_assessment_details so userHasAssessmentData() returns true.
// Body: { academyUserIds: string[] }
router.post("/admin/dashboard-access/import", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const raw = Array.isArray(req.body?.academyUserIds) ? req.body.academyUserIds : [];
    const ids: string[] = [];
    for (const entry of raw) {
      if (typeof entry === "string" && entry.trim()) ids.push(entry.trim());
    }

    if (ids.length === 0) {
      res.status(400).json({ error: "academyUserIds must be a non-empty array of strings" });
      return;
    }

    const now = new Date();
    const CHUNK = 500;
    let upsertedBasic = 0;
    let upsertedAssessment = 0;

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);

      // Upsert basic details (name stays null — will be filled on first BQ sync)
      const basicRows = await db
        .insert(academyUserBasicDetailsTable)
        .values(chunk.map((userId) => ({ userId, syncedAt: now })))
        .onConflictDoNothing({ target: academyUserBasicDetailsTable.userId })
        .returning({ userId: academyUserBasicDetailsTable.userId });
      upsertedBasic += basicRows.length;

      // Upsert a placeholder assessment row so userHasAssessmentData() passes
      const assessmentRows = await db
        .insert(academyUserAssessmentDetailsTable)
        .values(chunk.map((userId) => ({
          userId,
          organisationAssessmentId: "l1-july12-2026-access",
          syncedAt: now,
        })))
        .onConflictDoNothing()
        .returning({ id: academyUserAssessmentDetailsTable.id });
      upsertedAssessment += assessmentRows.length;
    }

    res.json({ requested: ids.length, upsertedBasic, upsertedAssessment });
  } catch (err) {
    req.log.error({ err }, "Failed to import dashboard access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/visibility-settings — read student result visibility toggles
router.get("/admin/visibility-settings", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const { map, releaseAtByKey, updatedAt, syncByTable, countsByKey } = await getVisibilitySettings({
      includeCounts: true,
    });
    res.json(toResponse(map, releaseAtByKey, updatedAt, syncByTable, countsByKey));
  } catch (err) {
    req.log.error({ err }, "Failed to get visibility settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/visibility-settings — upsert toggles (admin API key required)
// Body: { settings: { onlineL1Results?: boolean, ... }, releaseAt?: { onlineL1Results?: string|null } }
//    or { settings: { online_l1_results?: boolean, ... } }
router.put("/admin/visibility-settings", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const partial = parseAdminSettingsBody(req.body);
    if (!partial) {
      res.status(400).json({
        error:
          "Provide settings and/or releaseAt with at least one key: onlineL1Results, feProjectResults, aiMockResults, courseProgress",
      });
      return;
    }
    const { map, releaseAtByKey, updatedAt, syncByTable, countsByKey } =
      await updateVisibilitySettings(partial);
    res.json(toResponse(map, releaseAtByKey, updatedAt, syncByTable, countsByKey));
  } catch (err) {
    req.log.error({ err }, "Failed to update visibility settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/genai-training-popup — read GenAI Training pop-up content
router.get("/admin/genai-training-popup", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(await getGenAiTrainingPopup());
  } catch (err) {
    req.log.error({ err }, "Failed to get GenAI training popup settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/genai-training-popup — update GenAI Training pop-up content
router.put("/admin/genai-training-popup", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = parseGenAiTrainingPopupBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    res.json(await updateGenAiTrainingPopup(parsed.patch));
  } catch (err) {
    req.log.error({ err }, "Failed to update GenAI training popup settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Event types wiped when starting a fresh L1 Mock Start click counter. */
const L1_MOCK_CLICK_EVENT_TYPES = [
  "l1_july25_mock_start_click",
  "mock_assessment_link_click",
] as const;

// GET /api/admin/program-board — GenAI Program page and Assessment Calendar content
router.get("/admin/program-board", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json(await getProgramBoard());
  } catch (err) {
    req.log.error({ err }, "Failed to get program board");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/program-board — save GenAI Program and Assessment Calendar content
router.put("/admin/program-board", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const parsed = parseProgramBoardBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    res.json(await updateProgramBoard(parsed.board));
  } catch (err) {
    req.log.error({ err }, "Failed to update program board");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/fe-qualification-rules — FE tag thresholds (admin only)
router.get("/admin/fe-qualification-rules", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rules = await getFeQualificationRules();
    res.json({ rules, summary: await getFeAssessmentSummary() });
  } catch (err) {
    req.log.error({ err }, "Failed to get FE qualification rules");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/fe-qualification-rules — replace FE tag thresholds
router.put("/admin/fe-qualification-rules", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = req.body as { rules?: unknown };
    const rules = parseFeQualificationRules(body?.rules);
    if (!rules) {
      res.status(400).json({ error: "Add at least one rule with a tag, assessment numbers, and a percentage from 0 to 100." });
      return;
    }
    await updateFeQualificationRules(rules);
    res.json({ rules, summary: await getFeAssessmentSummary() });
  } catch (err) {
    req.log.error({ err }, "Failed to update FE qualification rules");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/l1-qualification-rules — L1 (Hustler) assessment thresholds (admin only)
router.get("/admin/l1-qualification-rules", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const rules = await getL1QualificationRules();
    res.json({ rules, summary: await getL1AssessmentSummary() });
  } catch (err) {
    req.log.error({ err }, "Failed to get L1 qualification rules");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/l1-qualification-rules — replace L1 (Hustler) assessment thresholds
router.put("/admin/l1-qualification-rules", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = req.body as { rules?: unknown };
    const rules = parseL1QualificationRules(body?.rules);
    if (!rules) {
      res.status(400).json({ error: "Add at least one rule with a tag, assessment numbers, and a percentage from 0 to 100." });
      return;
    }
    await updateL1QualificationRules(rules);
    res.json({ rules, summary: await getL1AssessmentSummary() });
  } catch (err) {
    req.log.error({ err }, "Failed to update L1 qualification rules");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/auth-code-logs — login token requests from the forms SSO (?outcome=&userId=&limit=)
router.get("/admin/auth-code-logs", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const q = req.query as Record<string, unknown>;
    res.json(
      await listAuthCodeLogs({
        outcome: typeof q.outcome === "string" ? q.outcome : null,
        userId: typeof q.userId === "string" ? q.userId : null,
        limit: typeof q.limit === "string" ? Number(q.limit) || undefined : undefined,
      }),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list auth code logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/admin/genai-qualification-rules — GenAI MCQ/coding cutoffs plus per-tag counts
router.get("/admin/genai-qualification-rules", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [rules, summary] = await Promise.all([
      getGenaiQualificationRules(),
      getGenaiAssessmentSummary(),
    ]);
    res.json({ rules, summary });
  } catch (err) {
    req.log.error({ err }, "Failed to get GenAI qualification rules");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/admin/genai-qualification-rules — replace GenAI MCQ/coding cutoffs
router.put("/admin/genai-qualification-rules", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = req.body as { rules?: unknown };
    const rules = parseGenaiQualificationRules(body?.rules);
    if (!rules) {
      res.status(400).json({ error: "Add at least one rule with a tag, assessment numbers, and MCQ and coding minimums." });
      return;
    }
    await updateGenaiQualificationRules(rules);
    res.json({ rules, summary: await getGenaiAssessmentSummary() });
  } catch (err) {
    req.log.error({ err }, "Failed to update GenAI qualification rules");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/genai-results/sync — pull GenAI assessment and NxtMock results from BigQuery now
router.post("/admin/genai-results/sync", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const result = await runGenaiBigQuerySync();
    res.status(result.ok ? 200 : 502).json({ ...result, summary: await getGenaiAssessmentSummary() });
  } catch (err) {
    req.log.error({ err }, "Failed to sync GenAI results");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/analytics/reset-l1-mock-clicks — zero the L1 Mock Start
// people-clicked counter (admin API key required). Deletes prior click rows.
router.post("/admin/analytics/reset-l1-mock-clicks", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const deleted = await db
      .delete(dashboardAnalyticsEventsTable)
      .where(inArray(dashboardAnalyticsEventsTable.eventType, [...L1_MOCK_CLICK_EVENT_TYPES]))
      .returning({ id: dashboardAnalyticsEventsTable.id });
    res.json({ ok: true, deletedRows: deleted.length });
  } catch (err) {
    req.log.error({ err }, "Failed to reset L1 mock click analytics");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/admin/preview-link — mint a short-lived SSO token so admins can
// open a student's dashboard view in a new tab (admin API key required).
// Body: { academyUserId: string }
router.post("/admin/preview-link", async (req, res) => {
  try {
    if (!checkApiKey(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const academyUserId =
      typeof (req.body as { academyUserId?: unknown })?.academyUserId === "string"
        ? (req.body as { academyUserId: string }).academyUserId.trim()
        : "";
    if (!academyUserId) {
      res.status(400).json({ error: "academyUserId is required" });
      return;
    }

    // Realign sequence after DB restores so token inserts don't collide on PK.
    try {
      await db.execute(
        sql.raw(
          `SELECT setval(pg_get_serial_sequence('forms_auth_tokens', 'id'), COALESCE((SELECT MAX(id) FROM forms_auth_tokens), 1))`,
        ),
      );
    } catch {
      // Best-effort; insert may still succeed if sequence is already correct.
    }

    const { authToken, expiresAt } = await createAuthToken(
      academyUserId,
      PREVIEW_TOKEN_TTL_MINUTES * 60 * 1000,
    );

    const originHeader = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
    const origin = (
      originHeader ||
      process.env["FORMS_REDIRECT_ORIGIN"] ||
      process.env["LEGACY_APP_ORIGIN"] ||
      "https://irp-dashboard-academy.replit.app"
    ).replace(/\/$/, "");

    res.json({
      ok: true,
      academyUserId,
      expiresAt: expiresAt.toISOString(),
      previewUrl: `${origin}?auth_token=${authToken}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create admin preview link");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
