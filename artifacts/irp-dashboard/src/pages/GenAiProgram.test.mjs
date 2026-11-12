import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./GenAiProgram.tsx", import.meta.url), "utf8");
const formSource = await readFile(new URL("../components/GenaiLoomSubmissionForm.tsx", import.meta.url), "utf8");

test("all three Kaggle challenge links render directly on their project cards", () => {
  const projectUrls = source.match(/url: "https:\/\/www\.kaggle\.com\/t\/[^"]+"/g) ?? [];

  assert.equal(projectUrls.length, 3, "the three project cards each have a Kaggle URL");
  assert.match(source, /GENAI_PROJECTS\.map\(\(project, index\) => \(/);
  assert.match(source, /href=\{project\.url\}/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /data-testid=\{`link-kaggle-genai-project-\$\{index \+ 1\}`\}/);
});

test("choosing a project marks it selected and opens its Kaggle URL in a new tab", () => {
  assert.match(source, /aria-pressed=\{selectedProjects\.includes\(project\.title\)\}/);
  assert.match(source, /toggleProject\(project\.title\);[\s\S]*?window\.open\(project\.url, "_blank", "noopener,noreferrer"\)/);
});

// Execute the form's actual submit handler, including its guard clauses.
function submitDraft(availableProjects, projectTitle, overrides = {}) {
  const handler = formSource.match(/  function handleSubmit\(event: FormEvent<HTMLFormElement>\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(handler, "the Loom form submit handler exists");
  const saves = [];
  const errors = [];
  const context = {
    availableProjects,
    projectTitle,
    hasTwoProjects: availableProjects.length === 2,
    loomUrl: "https://www.loom.com/share/example",
    loading: false,
    saving: false,
    isValidLoomUrl: (value) => value === "https://www.loom.com/share/example",
    setValidationError: (error) => errors.push(error),
    onSave: (input) => saves.push(input),
    ...overrides,
  };
  vm.runInNewContext(
    ts.transpileModule(`${handler}\nhandleSubmit({ preventDefault() {} });`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    context,
  );
  return { saves, errors };
}

test("zero or one selected project cannot submit, even with a saved project title", () => {
  for (const choices of [[], ["A"]]) {
    const { saves, errors } = submitDraft(choices, "A");
    assert.equal(saves.length, 0);
    assert.match(errors[0], /Select exactly 2 projects/);
  }
});

test("walkthrough must match one of exactly two selected projects", () => {
  for (const title of [null, "C"]) {
    const { saves, errors } = submitDraft(["A", "B"], title);
    assert.equal(saves.length, 0);
    assert.match(errors[0], /one of your 2 selected projects/);
  }
  for (const title of ["A", "B"]) {
    const { saves } = submitDraft(["A", "B"], title);
    assert.equal(saves.length, 1);
    assert.equal(saves[0].projectTitle, title);
  }
});

test("removing or replacing a selected project blocks stale walkthrough choices", () => {
  assert.equal(submitDraft(["B"], "A").saves.length, 0);
  assert.equal(submitDraft(["B", "C"], "A").saves.length, 0);
  assert.equal(submitDraft(["B", "C"], "C").saves.length, 1);
});

test("selection guard preserves URL validation and loading/saving protection", () => {
  assert.equal(submitDraft(["A", "B"], "A", { loomUrl: "invalid" }).saves.length, 0);
  assert.equal(submitDraft(["A", "B"], "A", { loading: true }).saves.length, 0);
  assert.equal(submitDraft(["A", "B"], "A", { saving: true }).saves.length, 0);
});

test("dropdown lists every title until 2 are chosen, then only the chosen pair", () => {
  assert.match(source, /allProjects=\{GENAI_PROJECT_TITLES\}/);
  assert.match(source, /availableProjects=\{selectedProjects\}/);
  assert.match(formSource, /hasTwoProjects \? availableProjects : allProjects/);
  assert.match(formSource, /disabled=\{saving\}/);
  assert.match(source, /if \(selectedProjects\.length >= 2\) return;\s*setSelectedProjects\(\[\.\.\.selectedProjects, title\]\)/);
  assert.match(formSource, /disabled=\{!canSubmitProject \|\| loading \|\| saving \|\| !loomUrl\.trim\(\)\}/);
  assert.doesNotMatch(source, /selectedLoomProject \?\? loomSubmission/);
});
