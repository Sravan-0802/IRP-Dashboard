import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./GenAiProgram.tsx", import.meta.url), "utf8");

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
