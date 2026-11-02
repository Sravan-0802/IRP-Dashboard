import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GenaiProjectProgressResponse } from "@workspace/api-client-react";
import { ExternalLink, RefreshCw } from "lucide-react";

export function GenaiLoomProgressPanel({ apiKey }: { apiKey: string }) {
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "genai-loom-progress", apiKey, search, status, page],
    queryFn: async ({ signal }): Promise<GenaiProjectProgressResponse> => {
      const params = new URLSearchParams({ search, status, page: String(page) });
      const res = await fetch(`/api/admin/genai-project-progress?${params}`, {
        headers: { "x-api-key": apiKey.trim() },
        signal,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load Loom progress.");
      return body;
    },
    enabled: Boolean(apiKey.trim()),
    staleTime: 10000,
    refetchInterval: 30000,
    retry: 1,
  });
  const data = query.data;
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)));

  return (
    <section className="rounded-2xl border border-[#e6e1f0] bg-white p-5 sm:p-6" data-testid="admin-loom-progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#0d1117]">Student Loom progress</h2>
          <p className="mt-1 text-sm text-[#6e6a8a]">
            All students, including those who have not submitted. In progress means no saved Loom submission.
          </p>
        </div>
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      {data ? (
        <p className="mt-4 text-sm font-semibold text-[#475467]" data-testid="admin-loom-counts">
          {data.allStudents.toLocaleString()} students · {data.submitted.toLocaleString()} submitted · {data.inProgress.toLocaleString()} in progress
        </p>
      ) : null}
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setSearch(searchDraft.trim()); setPage(1); }}>
        <label htmlFor="loom-progress-search" className="sr-only">Search student name or Academy ID</label>
        <input id="loom-progress-search" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search name or Academy ID" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-lg bg-[#6741d9] px-4 py-2 text-sm font-bold text-white">Search</button>
        <label htmlFor="loom-progress-filter" className="sr-only">Submission status</label>
        <select id="loom-progress-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border bg-white px-3 py-2 text-sm">
          <option value="all">All students</option>
          <option value="submitted">Submitted</option>
          <option value="in_progress">In progress</option>
        </select>
      </form>
      {query.isError ? <p role="alert" className="mt-4 text-sm text-red-700">{query.error.message} Use Refresh to retry.</p> : null}
      {query.isLoading ? <p className="mt-4 text-sm text-[#6e6a8a]">Loading student progress…</p> : null}
      {data ? (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#f8f7fc] text-xs text-[#6e6a8a]"><tr>
                {["Student", "Status", "Project", "Loom walkthrough", "Last submitted (IST)"].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#eceaf5]">
                {data.students.map((student) => (
                  <tr key={student.userId} data-testid="admin-loom-student-row">
                    <td className="px-3 py-3"><p className="font-semibold">{student.name}</p><p className="mt-1 font-mono text-xs text-[#6e6a8a]">{student.userId}</p></td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${student.status === "submitted" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{student.status === "submitted" ? "Submitted" : "In progress"}</span></td>
                    <td className="px-3 py-3">{student.projectTitle ?? "—"}</td>
                    <td className="px-3 py-3">{student.loomUrl ? <a href={student.loomUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#6741d9] hover:underline">Open Loom <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-[#6e6a8a]">Not submitted yet</span>}</td>
                    <td className="px-3 py-3">{student.updatedAt ? new Date(student.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td>
                  </tr>
                ))}
                {data.students.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-[#6e6a8a]">No students match this search and status.</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#6e6a8a]">
            <p>{data.total.toLocaleString()} matching students · Page {page} of {pages}. Updates every 30 seconds.</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
              <button type="button" disabled={page >= pages || query.isFetching} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
