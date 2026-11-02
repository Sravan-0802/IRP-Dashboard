export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // Prevent values from being interpreted as spreadsheet formulas.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
