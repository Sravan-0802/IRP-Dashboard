import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, importAssessmentCsv, parseCsv, replaceMonthEvents } from "@/lib/assessmentCalendarCsv";

let n = 0;
const id = () => `id-${++n}`;

describe("assessment calendar CSV", () => {
  it("parses quotes, commas, newlines, escaped quotes and BOM", () => {
    const { rows, error } = parseCsv('\ufeffa,b\r\n"x, ""y""","line1\nline2"\r\n');
    expect(error).toBeNull();
    expect(rows).toEqual([["a", "b"], ['x, "y"', "line1\nline2"]]);
  });
  it("imports the template for its month", () => {
    const r = importAssessmentCsv(CSV_TEMPLATE, 2030, 0, id);
    expect(r.errors).toEqual([]);
    expect(r.events.map((e) => e.label)).toContain("Mock Assessment, Set A");
    expect(r.events[1]).toMatchObject({ mode: "online", program: "genai" });
  });
  it("accepts a file and rows with no assessment link", () => {
    const r = importAssessmentCsv(
      "Assessment Name,Assessment Date,Assessment Mode\nExam,2030-01-12,Offline\n",
      2030, 0, id,
    );
    expect(r.errors).toEqual([]);
    expect(r.events[0]).toMatchObject({ label: "Exam", mode: "offline" });
    expect(r.events[0].link).toBeUndefined();
  });
  it("accepts a blank optional assessment link column", () => {
    const r = importAssessmentCsv(
      "Assessment Name,Assessment Date,Assessment Mode,Assessment Link\nExam,2030-01-12,Online,\n",
      2030, 0, id,
    );
    expect(r.errors).toEqual([]);
    expect(r.events[0].link).toBeUndefined();
  });
  it("still rejects a provided unsafe assessment link", () => {
    const r = importAssessmentCsv(
      "Assessment Name,Assessment Date,Assessment Mode,Assessment Link\nExam,2030-01-12,Online,javascript:alert(1)\n",
      2030, 0, id,
    );
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toMatch(/Assessment Link must be/);
  });
  it("rejects the whole file when any row is invalid", () => {
    const csv = "Assessment Name,Assessment Date,Assessment Mode,Assessment Link\nOk,2030-01-02,Online,https://example.com\n,2030-02-31,Hybrid,javascript:alert(1)\nOut,2030-02-01,Offline,https://example.com\n";
    const r = importAssessmentCsv(csv, 2030, 0, id);
    expect(r.events).toEqual([]);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4]);
  });
  it("reports missing headers", () => {
    expect(importAssessmentCsv("Assessment Name,Assessment Date\nA,2030-01-01\n", 2030, 0, id).errors[0].message).toMatch(/Missing column/);
  });
  it("replaces only the selected month", () => {
    const all = [
      { id: "a", date: "2030-01-05", program: "irp" as const, label: "Old Jan" },
      { id: "b", date: "2030-02-05", program: "irp" as const, label: "Feb" },
    ];
    const next = replaceMonthEvents(all, 2030, 0, [{ id: "c", date: "2030-01-09", program: "genai", label: "New", mode: "online", link: "https://example.com" }]);
    expect(next.map((e) => e.id).sort()).toEqual(["b", "c"]);
  });
  it("refuses an old import preview after the selected month changes", () => {
    const incoming = [{ id: "a", date: "2030-01-09", program: "irp" as const, label: "Jan" }];
    expect(() => replaceMonthEvents([], 2030, 1, incoming)).toThrow(/selected month/);
  });
  it("refuses an import that would exceed the total calendar limit", () => {
    const existing = Array.from({ length: 1000 }, (_, i) => ({
      id: `existing-${i}`, date: "2030-02-05", program: "irp" as const, label: "Keep",
    }));
    expect(() => replaceMonthEvents(existing, 2030, 0, [
      { id: "new", date: "2030-01-05", program: "irp", label: "New" },
    ])).toThrow(/1000-assessment/);
    expect(existing).toHaveLength(1000);
  });
});
