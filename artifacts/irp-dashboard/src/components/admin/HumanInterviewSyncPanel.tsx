import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, RefreshCw } from "lucide-react";
import {
  useGetHumanInterviewSyncStatus,
  getGetHumanInterviewSyncStatusQueryKey,
  useSyncHumanInterviewResults,
  getGetHumanInterviewResultsQueryKey,
} from "@workspace/api-client-react";

function errMsg(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: string } } | null)?.data;
  if (data && typeof data.error === "string" && data.error) return data.error;
  return err instanceof Error && err.message ? err.message : fallback;
}

function fmt(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function HumanInterviewSyncPanel({ apiKey, onSynced }: { apiKey: string; onSynced?: () => void }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const headers = { headers: { "x-api-key": apiKey } };
  const status = useGetHumanInterviewSyncStatus({
    query: {
      queryKey: [...getGetHumanInterviewSyncStatusQueryKey(), apiKey],
      enabled: !!apiKey,
      staleTime: 30_000,
      refetchInterval: 5_000,
      retry: false,
    },
    request: headers,
  });
  const sync = useSyncHumanInterviewResults({
    request: headers,
    mutation: {
      onMutate: () => setMessage(""),
      onSuccess: (res) => {
        qc.setQueryData([...getGetHumanInterviewSyncStatusQueryKey(), apiKey], res);
        void qc.invalidateQueries({ queryKey: getGetHumanInterviewSyncStatusQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetHumanInterviewResultsQueryKey() });
        setMessage(
          `Fetched ${res.interviewCount.toLocaleString()} interviews for ${res.studentCount.toLocaleString()} students at ${fmt(res.syncedAt)}. Existing release settings are unchanged.`,
        );
        onSynced?.();
      },
    },
  });

  const s = status.data;
  const busy = sync.isPending || !!s?.running;
  const notConfigured = s && !s.configured;

  return (
    <div className="irp-card p-5" data-testid="panel-hi-sync">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-[#6741d9]" />
            <h2 className="font-display text-lg font-extrabold text-[#0d1117]">Human Interview results</h2>
          </div>
          <p className="mt-1 text-sm text-[#6e6a8a]">
            Fetch all IRP L1 interview attempts from Academy Nexus. Fetching does not release results to students.
          </p>
        </div>
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={!apiKey || busy || !!notConfigured}
          className="btn-pop inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold"
          data-testid="button-fetch-hi-results"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {busy ? "Fetching..." : "Fetch interview results"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="status-hi-sync">
        {status.isLoading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#f2f4f7]" />)
        ) : (
          [
            ["Source", s ? (s.configured ? "Configured" : "Not configured") : "—"],
            ["Last fetched", s ? fmt(s.syncedAt) : "—"],
            ["Interviews", s ? s.interviewCount.toLocaleString() : "—"],
            ["Students", s ? s.studentCount.toLocaleString() : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[rgba(103,65,217,0.1)] bg-[#faf9ff] px-3 py-2">
              <p className="text-[11px] font-semibold text-[#6e6a8a]">{k}</p>
              <p className="text-sm font-bold text-[#0d1117]">{v}</p>
            </div>
          ))
        )}
      </div>

      {notConfigured ? (
        <p className="mt-3 text-sm font-semibold text-[#b54708]">The interview source is not configured on the server.</p>
      ) : null}
      {status.isError ? (
        <p className="mt-3 text-sm font-semibold text-[#b42318]" data-testid="text-hi-status-error">
          {errMsg(status.error, "Could not load fetch status.")}{" "}
          <button type="button" className="underline" onClick={() => void status.refetch()}>Retry</button>
        </p>
      ) : null}
      {sync.isError ? (
        <p className="mt-3 text-sm font-semibold text-[#b42318]" data-testid="text-hi-sync-error">
          {errMsg(sync.error, "Fetch failed.")}
        </p>
      ) : null}
      {message && !sync.isError ? (
        <p className="mt-3 text-sm font-semibold text-[#067647]" data-testid="text-hi-sync-success">{message}</p>
      ) : null}
    </div>
  );
}
