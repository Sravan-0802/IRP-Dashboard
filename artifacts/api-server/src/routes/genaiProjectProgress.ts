import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { GetGenaiProjectProgressResponse } from "@workspace/api-zod";
import { checkApiKey } from "../lib/apiKey";

const router = Router();
const PAGE_SIZE = 50;

router.get("/admin/genai-project-progress", async (req, res) => {
  if (!checkApiKey(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const search = String(req.query.search ?? "").trim().slice(0, 200);
  const status = String(req.query.status ?? "all");
  const page = Number(req.query.page ?? 1);
  if (!["all", "submitted", "in_progress"].includes(status) ||
      !Number.isSafeInteger(page) || page < 1 || page > 100000) {
    res.status(400).json({ error: "Invalid status or page." });
    return;
  }

  // Include the whole student roster, not only people who have already saved a
  // link. UNION also retains submitted students when a mirror row is missing.
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  try {
    const result = await db.execute(sql`
      WITH roster AS (
        SELECT user_id FROM academy_user_basic_details
        UNION SELECT user_id FROM academy_user_assessment_details
        UNION SELECT user_id FROM genai_project_submissions
      ), progress AS (
        SELECT r.user_id AS "userId",
          COALESCE(NULLIF(TRIM(b.name_on_certificate), ''),
            NULLIF(TRIM(b.user_name), ''),
            NULLIF(TRIM(CONCAT_WS(' ', b.first_name, b.last_name)), ''),
            'Student') AS name,
          CASE WHEN s.user_id IS NOT NULL THEN 'submitted' ELSE 'in_progress' END AS status,
          s.project_title AS "projectTitle", s.loom_url AS "loomUrl",
          s.updated_at AS "updatedAt"
        FROM roster r
        LEFT JOIN academy_user_basic_details b ON b.user_id = r.user_id
        LEFT JOIN genai_project_submissions s ON s.user_id = r.user_id
      ), filtered AS (
        SELECT * FROM progress
        WHERE (${status} = 'all' OR status = ${status})
          AND (${search} = '' OR name ILIKE ${pattern} OR "userId" ILIKE ${pattern})
      ), page_rows AS (
        SELECT * FROM filtered
        ORDER BY "updatedAt" DESC NULLS LAST, name, "userId"
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
      )
      SELECT
        (SELECT COUNT(*)::int FROM progress) AS "allStudents",
        (SELECT COUNT(*)::int FROM progress WHERE status = 'submitted') AS submitted,
        (SELECT COUNT(*)::int FROM progress WHERE status = 'in_progress') AS "inProgress",
        (SELECT COUNT(*)::int FROM filtered) AS total,
        ${page}::int AS page, ${PAGE_SIZE}::int AS "pageSize",
        COALESCE((SELECT JSON_AGG(page_rows) FROM page_rows), '[]'::json) AS students
    `);
    res.json(GetGenaiProjectProgressResponse.parse(result.rows[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to load student Loom progress");
    res.status(500).json({ error: "Could not load Loom progress. Please retry." });
  }
});

export default router;
