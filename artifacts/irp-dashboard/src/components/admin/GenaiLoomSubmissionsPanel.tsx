import { Download, ExternalLink, RefreshCw, Video } from "lucide-react";
import {
  getListGenaiProjectSubmissionsQueryKey,
  useListGenaiProjectSubmissions,
} from "@workspace/api-client-react";
import { buildSubmissionsCsv, type LoomSubmissionRow } from "./genaiLoomSubmissionsCsv";

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function downloadSubmissionsCsv(records: readonly LoomSubmissionRow[]) {
  const csv = buildSubmissionsCsv(records);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `genai-loom-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GenaiLoomSubmissionsPanel({ apiKey }: { apiKey: string }) {
  const submissions = useListGenaiProjectSubmissions({
    query: {
      queryKey: [...getListGenaiProjectSubmissionsQueryKey(), apiKey],
      enabled: !!apiKey.trim(),
      staleTime: 30_000,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: false,
    },
    request: { headers: { "x-api-key": apiKey.trim() } },
  });

  const records: LoomSubmissionRow[] = submissions.data?.submissions ?? [];

  return (
    <section className="irp-card p-5" data-testid="panel-genai-loom-submissions">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-[#6741d9]" />
            <h2 className="font-display text-lg font-extrabold text-[#0d1117]">
              Loom walkthrough submissions
            </h2>
            <span
              className="rounded-full bg-[#f3f0ff] px-2 py-0.5 text-xs font-bold text-[#6741d9]"
              data-testid="text-genai-loom-submission-count"
            >
              {records.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#6e6a8a]">
            Student submissions, ordered by most recently updated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadSubmissionsCsv(records)}
            disabled={submissions.isFetching || submissions.isError}
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(59,91,219,0.18)] bg-white px-4 py-2 text-sm font-bold text-[#3b5bdb] hover:bg-[#eef2ff] disabled:opacity-50"
            data-testid="button-download-genai-loom-submissions"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => void submissions.refetch()}
            disabled={submissions.isFetching}
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(59,91,219,0.18)] bg-white px-4 py-2 text-sm font-bold text-[#3b5bdb] hover:bg-[#eef2ff] disabled:opacity-50"
            data-testid="button-refresh-genai-loom-submissions"
          >
            <RefreshCw className={`h-4 w-4 ${submissions.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {submissions.isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading Loom submissions">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-16 animate-pulse rounded-xl bg-[#f2f4f7]" />
          ))}
        </div>
      ) : submissions.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          Could not load Loom submissions.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void submissions.refetch()}
            data-testid="button-retry-genai-loom-submissions"
          >
            Try again
          </button>
        </div>
      ) : records.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[rgba(103,65,217,0.2)] bg-[#faf9ff] px-4 py-8 text-center text-sm text-[#6e6a8a]" data-testid="text-no-genai-loom-submissions">
          No Loom walkthroughs have been submitted yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[rgba(103,65,217,0.12)] text-[11px] font-bold uppercase tracking-wider text-[#6e6a8a]">
                <th className="px-3 py-3">Student</th>
                <th className="px-3 py-3">Project</th>
                <th className="px-3 py-3">Last updated</th>
                <th className="px-3 py-3">Walkthrough</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.academyUserId}
                  className="border-b border-[rgba(103,65,217,0.08)] last:border-0"
                  data-testid={`row-genai-loom-submission-${record.academyUserId}`}
                >
                  <td className="px-3 py-3">
                    <p className="font-bold text-[#0d1117]" data-testid={`text-genai-loom-student-${record.academyUserId}`}>
                      {record.studentName}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6e6a8a]">{record.academyUserId}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-[#344054]">{record.projectTitle}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#475467]">
                    {formatUpdatedAt(record.updatedAt)}
                  </td>
                  <td className="px-3 py-3">
                    <a
                      href={record.loomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[360px] items-center gap-1.5 break-all rounded-lg bg-[#6741d9] px-3 py-2 text-xs font-bold text-white hover:bg-[#5632c2]"
                      data-testid={`link-open-genai-loom-${record.academyUserId}`}
                    >
                      {record.loomUrl}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
