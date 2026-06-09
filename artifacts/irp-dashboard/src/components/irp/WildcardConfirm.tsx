import { Zap, Check, X } from "lucide-react";

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
    <div className="mx-auto w-full max-w-2xl">
      <div className="irp-card irp-glow p-7 sm:p-9">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6eb4] to-[#c45fff] text-white">
            <Zap className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-[#e8e6ff]">
            Before you go wildcard — read this.
          </h2>
        </div>

        <p className="text-[15px] leading-relaxed text-[#b9a7ff]">
          L3 is the hardest level. It covers everything from HTML/CSS to DSA Level 4 in one
          assessment.
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-[#1d9e75]/30 bg-[#1d9e75]/10 p-3.5">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#5fe0ad]" />
            <p className="text-sm text-[#cfe9df]">
              Pick Wildcard if you're already strong in frontend, backend, and DSA.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
            <X className="mt-0.5 h-5 w-5 shrink-0 text-[#7a6eaa]" />
            <p className="text-sm text-[#a99fce]">
              Don't pick Wildcard if you're still learning the basics.
            </p>
          </div>
        </div>

        <p className="mt-5 rounded-xl border border-[#8a6eff]/25 bg-[#8a6eff]/10 p-3.5 text-sm text-[#b9a7ff]">
          You can switch back to the standard path anytime before your exam — but once the exam
          starts, you're committed.
        </p>

        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8a6eff] to-[#c45fff] px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-bold text-[#b9a7ff] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
