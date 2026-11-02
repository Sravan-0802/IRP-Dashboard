export type LoomSubmissionRow = {
  academyUserId: string;
  studentName: string;
  projectTitle: string;
  updatedAt: string;
  loomUrl: string;
};

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // Prevent values from being interpreted as spreadsheet formulas.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildSubmissionsCsv(records: readonly LoomSubmissionRow[]): string {
  const rows = [
    ["Student name", "Academy user ID", "Project", "Last updated (ISO)", "Loom URL"],
    ...records.map((record) => [
      record.studentName,
      record.academyUserId,
      record.projectTitle,
      record.updatedAt,
      record.loomUrl,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
