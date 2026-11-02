import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenaiLoomSubmissionForm } from "./GenaiLoomSubmissionForm";

afterEach(cleanup);

function renderForm(overrides: Partial<React.ComponentProps<typeof GenaiLoomSubmissionForm>> = {}) {
  const onSave = vi.fn();
  render(
    React.createElement(GenaiLoomSubmissionForm, {
      projectTitle: "Intelligent RAG Challenge",
      availableProjects: [
        "Intelligent RAG Challenge",
        "Agentic RAG Challenge",
        "Building & Optimizing RAG Challenge",
      ],
      onProjectChange: vi.fn(),
      submission: null,
      loading: false,
      loadError: null,
      onRetry: vi.fn(),
      saving: false,
      saveError: null,
      savedSubmission: null,
      onSave,
      onResetSaveState: vi.fn(),
      ...overrides,
    }),
  );
  return onSave;
}

describe("GenAI Loom submission form", () => {
  it("shows validation feedback and does not submit unrelated URLs", () => {
    const onSave = renderForm();
    fireEvent.change(screen.getByLabelText("Loom video URL"), {
      target: { value: "https://example.com/watch/video" },
    });
    fireEvent.submit(screen.getByTestId("button-submit-genai-loom").closest("form")!);

    expect(screen.getByRole("alert").textContent).toMatch(/valid Loom share or embed link/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submits a trimmed valid Loom embed URL", () => {
    const onSave = renderForm();
    fireEvent.change(screen.getByLabelText("Loom video URL"), {
      target: { value: "  https://www.loom.com/embed/video-123  " },
    });
    fireEvent.submit(screen.getByTestId("button-submit-genai-loom").closest("form")!);

    expect(onSave).toHaveBeenCalledWith({
      projectTitle: "Intelligent RAG Challenge",
      loomUrl: "https://www.loom.com/embed/video-123",
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows confirmation for a saved submission", () => {
    renderForm({
      savedSubmission: {
        projectTitle: "Intelligent RAG Challenge",
        loomUrl: "https://www.loom.com/share/saved-video",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    fireEvent.change(screen.getByLabelText("Loom video URL"), {
      target: { value: "https://www.loom.com/share/saved-video" },
    });

    expect(screen.getByRole("status").textContent).toMatch(/Successfully submitted.*saved/i);
  });

  it("shows request-error feedback from the save request", () => {
    renderForm({ saveError: "The service is unavailable. Please try again." });
    expect(screen.getByTestId("text-genai-loom-error").textContent).toMatch(/service is unavailable/i);
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
