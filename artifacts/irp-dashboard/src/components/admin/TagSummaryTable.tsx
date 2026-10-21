export type TagSummary = { tag: string; total: number; attempted: number; qualified: number };

export function TagSummaryTable({
  summary,
  note,
  emptyText,
}: {
  summary: TagSummary[];
  note: string;
  emptyText: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-extrabold text-[#101828]">Synced results by tag</h3>
      <p className="mt-0.5 text-xs text-[#667085]">{note}</p>
      {summary.length === 0 ? (
        <p className="mt-2 text-sm text-[#667085]">{emptyText}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#eaecf0] text-xs text-[#667085]">
                <th className="py-2 pr-3 font-semibold">Tag</th>
                <th className="py-2 pr-3 font-semibold">With access</th>
                <th className="py-2 pr-3 font-semibold">Attempted</th>
                <th className="py-2 font-semibold">Qualified</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.tag} className="border-b border-[#f2f4f7]">
                  <td className="py-2 pr-3 font-medium text-[#101828]">{row.tag}</td>
                  <td className="py-2 pr-3 text-[#344054]">{row.total}</td>
                  <td className="py-2 pr-3 text-[#344054]">{row.attempted}</td>
                  <td className="py-2 font-semibold text-[#067647]">{row.qualified}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
