import { useEffect, useState, type FormEvent } from "react";
import { Check, ExternalLink, Video } from "lucide-react";

export type LoomSubmissionRecord = {
  projectTitle: string;
  loomUrl: string;
  updatedAt: string;
};

function isValidLoomUrl(value: string): boolean {
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

export function GenaiLoomSubmissionForm({
  projectTitle,
  availableProjects,
  onProjectChange,
  submission,
  loading,
  loadError,
  onRetry,
  saving,
  saveError,
  savedSubmission,
  onSave,
  onResetSaveState,
}: {
  projectTitle: string | null;
  availableProjects: string[];
  onProjectChange: (title: string) => void;
  submission: LoomSubmissionRecord | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  saving: boolean;
  saveError: string | null;
  savedSubmission: LoomSubmissionRecord | null;
  onSave: (input: { projectTitle: string; loomUrl: string }) => void;
  onResetSaveState: () => void;
}) {
  const [loomUrl, setLoomUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const hasTwoProjects = availableProjects.length === 2;
  const canSubmitProject = hasTwoProjects && projectTitle !== null && availableProjects.includes(projectTitle);

  useEffect(() => {
    setLoomUrl(submission?.loomUrl ?? "");
    setValidationError(null);
  }, [submission?.loomUrl]);

  useEffect(() => {
    setValidationError(null);
  }, [projectTitle, hasTwoProjects]);

  const savedForCurrentDraft =
    Boolean(projectTitle) &&
    ((submission?.projectTitle === projectTitle && submission.loomUrl === loomUrl.trim()) ||
      (savedSubmission?.projectTitle === projectTitle && savedSubmission.loomUrl === loomUrl.trim()));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || saving) return;
    const value = loomUrl.trim();
    if (!hasTwoProjects) {
      setValidationError("Select exactly 2 projects in Project Submission before submitting or updating your Loom walkthrough.");
      return;
    }
    if (!projectTitle || !availableProjects.includes(projectTitle)) {
      setValidationError("Choose one of your 2 selected projects for your Loom walkthrough.");
      return;
    }
    if (!isValidLoomUrl(value)) {
      setValidationError("Enter a valid Loom share or embed link, such as https://www.loom.com/share/your-video.");
      return;
    }

    setValidationError(null);
    onSave({ projectTitle, loomUrl: value });
  }

  return (
    <section
      className="rounded-xl border border-[#d6bbfb] bg-[#fcfaff] p-4 sm:p-5"
      data-testid="section-genai-loom-submission"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4f3ff] text-[#6941c6]">
          <Video className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-base font-extrabold text-[#101828]">Loom walkthrough</h4>
          <p
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${submission || savedSubmission ? "bg-[#ecfdf3] text-[#067647]" : "bg-[#fff4e5] text-[#93370d]"}`}
            data-testid="text-genai-loom-status"
          >
            {submission || savedSubmission
              ? "Submitted"
              : loading
                ? "Checking status…"
                : loadError
                  ? "Status unavailable"
                  : "In progress"}
          </p>
          <p className="mt-1 text-sm text-[#475467]">
            {canSubmitProject
              ? `Submit a walkthrough for ${projectTitle}. You can update the link later.`
              : "Select exactly 2 projects in Project Submission before submitting or updating your Loom walkthrough."}
          </p>
          <p id="genai-loom-selection-help" className="mt-2 text-sm text-[#475467]" aria-live="polite">
            {hasTwoProjects
              ? "Choose one of your 2 selected projects below. To change your choices, remove a project in Project Submission and choose another."
              : `${availableProjects.length} of 2 projects selected. Open Project Submission above and choose your projects first.`}
          </p>
          {submission ? (
            <p className="mt-2 text-xs font-medium text-[#475467]" data-testid="text-genai-loom-saved-project">
              Current saved submission: {submission.projectTitle}
            </p>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#b42318]" role="alert">
          <span>Could not load your saved Loom link: {loadError}</span>
          <button type="button" onClick={onRetry} className="font-bold underline">
            Retry
          </button>
        </div>
      ) : null}

      <form className="mt-4 space-y-3" noValidate onSubmit={handleSubmit}>
        <div>
          <label htmlFor="genai-loom-project" className="mb-1.5 block text-sm font-semibold text-[#344054]">
            Project for your walkthrough
          </label>
          <select
            id="genai-loom-project"
            data-testid="select-genai-loom-project"
            value={projectTitle ?? ""}
            disabled={!hasTwoProjects || saving}
            aria-describedby="genai-loom-selection-help"
            onChange={(event) => onProjectChange(event.target.value)}
            className="w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2.5 text-sm text-[#101828]"
          >
            <option value="" disabled>Choose a project</option>
            {availableProjects.map((title) => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="genai-loom-url" className="mb-1.5 block text-sm font-semibold text-[#344054]">
            Loom video URL
          </label>
          <input
            id="genai-loom-url"
            data-testid="input-genai-loom-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://www.loom.com/share/..."
            value={loomUrl}
            onChange={(event) => {
              setLoomUrl(event.target.value);
              setValidationError(null);
              onResetSaveState();
            }}
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? "genai-loom-url-error" : undefined}
            className="w-full rounded-lg border border-[#d0d5dd] bg-white px-3 py-2.5 text-sm text-[#101828] outline-none transition focus:border-[#6941c6] focus:ring-2 focus:ring-[#6941c6]/20"
          />
          {validationError ? (
            <p id="genai-loom-url-error" className="mt-1.5 text-sm text-[#b42318]" role="alert">
              {validationError}
            </p>
          ) : null}
        </div>

        {saveError ? (
          <p className="text-sm text-[#b42318]" role="alert" data-testid="text-genai-loom-error">
            {saveError}
          </p>
        ) : null}
        {savedForCurrentDraft ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#067647]" role="status" aria-live="polite" data-testid="text-genai-loom-saved">
            <Check className="h-4 w-4" />
            Successfully submitted. Your Loom walkthrough has been saved.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            data-testid="button-submit-genai-loom"
            disabled={!canSubmitProject || loading || saving || !loomUrl.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#6941c6] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#53389e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : submission ? "Update Loom link" : "Submit Loom link"}
          </button>
          {submission && !savedForCurrentDraft ? (
            <a
              href={submission.loomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#6941c6] hover:underline"
            >
              Open saved walkthrough
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </form>
    </section>
  );
}
