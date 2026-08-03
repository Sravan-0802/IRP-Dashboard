/** Parse academy user IDs from CSV text or a newline/comma-separated paste. */
export function parseAcademyUserIds(raw: string): string[] {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const splitCols = (line: string) =>
    line.split(/[,;\t]/).map((c) => c.trim().replace(/^["']|["']$/g, ""));

  const headerCols = splitCols(lines[0]).map((c) => c.toLowerCase());
  const uidCol = headerCols.findIndex(
    (c) =>
      c === "academy_user_id" ||
      c === "academyuserid" ||
      c === "user_id" ||
      c === "userid" ||
      c === "uid" ||
      c === "id",
  );
  const hasHeader = uidCol >= 0;
  const colIndex = hasHeader ? uidCol : 0;
  const start = hasHeader ? 1 : 0;

  const ids: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = splitCols(lines[i]);
    const id = (cols[colIndex] ?? cols[0] ?? "").trim();
    if (id && !/^(academy_user_id|user_id|uid|id)$/i.test(id)) {
      ids.push(id);
    }
  }

  return [...new Set(ids)];
}
