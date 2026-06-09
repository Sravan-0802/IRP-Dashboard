export function WildcardConfirm({
  onConfirm,
  onCancel,
  confirmLabel = "Yes, I'm ready — take me to L3",
  cancelLabel = "Actually, start me on Standard Path",
  busy = false,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[520px]">
      <div className="rounded-[20px] border border-[rgba(103,65,217,0.1)] bg-white p-7 shadow-soft-md sm:p-9">
        <div className="mb-4 text-center text-5xl">⚡</div>
        <h2 className="text-center font-display text-2xl font-extrabold text-ink">
          Before you go wildcard — read this.
        </h2>

        <p className="mt-5 text-[15px] leading-relaxed text-muted2">
          L3 is the hardest level. It covers everything from HTML/CSS to DSA Level 4 in one
          assessment.
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-[rgba(12,166,120,0.25)] bg-[#d3f9d8] p-3.5">
            <span className="mt-0.5 text-base leading-none">✅</span>
            <p className="text-sm text-ink2">
              Pick Wildcard if you're already strong in frontend, backend, and DSA.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[#dee2e6] bg-[#f8f9fa] p-3.5">
            <span className="mt-0.5 text-base leading-none">❌</span>
            <p className="text-sm text-muted2">
              Don't pick Wildcard if you're still learning the basics.
            </p>
          </div>
        </div>

        <div className="my-6 h-px bg-[rgba(103,65,217,0.08)]" />

        <p className="rounded-xl border border-[rgba(103,65,217,0.15)] bg-[rgba(103,65,217,0.06)] p-3.5 text-sm text-ink2">
          You can switch back to the standard path anytime before your exam — but once the exam
          starts, you're committed.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl px-5 py-3 font-display text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(90deg,#9c36b5,#e64980)" }}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-[rgba(103,65,217,0.2)] bg-[rgba(103,65,217,0.08)] px-5 py-3 text-sm font-bold text-brand transition-colors hover:bg-[rgba(103,65,217,0.12)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
