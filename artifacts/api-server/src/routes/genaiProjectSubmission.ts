import { Router, type Request } from "express";
import {
  GetGenaiProjectSubmissionResponse,
  SaveGenaiProjectSubmissionBody,
  SaveGenaiProjectSubmissionResponse,
} from "@workspace/api-zod";

export type GenaiProjectSubmission = {
  projectTitle: string;
  loomUrl: string;
  updatedAt: Date;
};

export type GenaiProjectSubmissionRepository = {
  findForUser(userId: string): Promise<GenaiProjectSubmission | null>;
  saveForUser(
    userId: string,
    projectTitle: string,
    loomUrl: string,
  ): Promise<GenaiProjectSubmission>;
};

type GenaiProjectSubmissionRouteDependencies = {
  resolveAcademyUserId: (req: Request) => Promise<string | null>;
  repository: GenaiProjectSubmissionRepository;
};

const GENAI_PROJECT_TITLES = new Set([
  "Intelligent RAG Challenge",
  "Agentic RAG Challenge",
  "Building & Optimizing RAG Challenge",
]);

export function isLoomShareUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      (url.hostname === "loom.com" || url.hostname === "www.loom.com") &&
      /^\/(?:share|embed)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function createGenaiProjectSubmissionRouter({
  resolveAcademyUserId,
  repository,
}: GenaiProjectSubmissionRouteDependencies) {
  const router = Router();

  router.get("/student/genai-project-submission", async (req, res) => {
    try {
      const userId = await resolveAcademyUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const row = await repository.findForUser(userId);
      const response = GetGenaiProjectSubmissionResponse.parse({
        submission: row
          ? {
              projectTitle: row.projectTitle,
              loomUrl: row.loomUrl,
              updatedAt: row.updatedAt.toISOString(),
            }
          : null,
      });
      res.json(response);
    } catch (err) {
      req.log.error({ err }, "Failed to get GenAI project submission");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.put("/student/genai-project-submission", async (req, res) => {
    try {
      const userId = await resolveAcademyUserId(req);
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const parsed = SaveGenaiProjectSubmissionBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Enter a project and Loom walkthrough link." });
        return;
      }

      const projectTitle = parsed.data.projectTitle.trim();
      const loomUrl = parsed.data.loomUrl.trim();
      if (!GENAI_PROJECT_TITLES.has(projectTitle)) {
        res.status(400).json({ error: "Choose one of the available GenAI projects." });
        return;
      }
      if (!isLoomShareUrl(loomUrl)) {
        res.status(400).json({
          error: "Use an https://www.loom.com/share/... or Loom embed link.",
        });
        return;
      }

      const row = await repository.saveForUser(userId, projectTitle, loomUrl);
      const response = SaveGenaiProjectSubmissionResponse.parse({
        submission: {
          projectTitle: row.projectTitle,
          loomUrl: row.loomUrl,
          updatedAt: row.updatedAt.toISOString(),
        },
      });
      res.json(response);
    } catch (err) {
      req.log.error({ err }, "Failed to save GenAI project submission");
      res.status(500).json({ error: "Could not save your Loom link. Please try again." });
    }
  });

  return router;
}
