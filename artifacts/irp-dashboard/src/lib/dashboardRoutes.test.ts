import { describe, expect, it } from "vitest";
import { PAGE_PATHS, pathToPage } from "./dashboardRoutes";

describe("dashboard assessment routes", () => {
  it("opens the Assessments Hub on its own route", () => {
    expect(PAGE_PATHS.assessments).toBe("/assessments-hub");
    expect(pathToPage("/assessments-hub")).toBe("assessments");
    expect(pathToPage("/assessments-hub/")).toBe("assessments");
  });

  it("keeps the Assessment Calendar on its separate route", () => {
    expect(pathToPage("/assessment-calendar")).toBe("slot");
  });
});
