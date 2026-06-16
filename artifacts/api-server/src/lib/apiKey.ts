import type { Request } from "express";

export function extractApiKey(req: Request): string {
  const authHeader = req.headers["authorization"];
  const bearer =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
  const headerKey = req.headers["x-api-key"];
  if (typeof headerKey === "string" && headerKey.trim()) {
    return headerKey.trim();
  }
  return bearer;
}

/** Validates admin/service API keys for protected routes (sync, analytics). */
export function checkApiKey(req: Request): boolean {
  const provided = extractApiKey(req);
  if (!provided) return false;

  const analyticsKey = process.env["ANALYTICS_ADMIN_KEY"]?.trim();
  if (analyticsKey && provided === analyticsKey) return true;

  const tokenSecret = process.env["TOKEN_SECRET"]?.trim();
  if (tokenSecret && provided === tokenSecret) return true;

  if (process.env["NODE_ENV"] !== "production" && !analyticsKey && !tokenSecret) {
    return provided === "dev";
  }

  return false;
}
