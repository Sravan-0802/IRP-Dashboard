import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let ready: Promise<void> | null = null;

/** Add only the GenAI interview mirror, including on older deployed databases. */
export function ensureGenaiHumanInterviewSchema(): Promise<void> {
  if (!ready) {
    ready = db.execute(sql`
      CREATE TABLE IF NOT EXISTS genai_human_interview_results (
        interview_id text PRIMARY KEY,
        candidate_id text NOT NULL,
        interview_date text NOT NULL,
        interview_start_time text NOT NULL,
        interview_starts_at timestamptz,
        project_rating real,
        project_remarks text,
        concept_rating real,
        concept_remarks text,
        dsa_rating real,
        dsa_remarks text,
        communication_rating real,
        communication_remarks text,
        final_score real,
        verdict_band text NOT NULL DEFAULT '',
        clearance_status text NOT NULL,
        synced_at timestamptz NOT NULL DEFAULT now()
      )
    `).then(async () => {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS genai_human_interview_results_candidate_idx
        ON genai_human_interview_results (candidate_id)
      `);
    }).catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
