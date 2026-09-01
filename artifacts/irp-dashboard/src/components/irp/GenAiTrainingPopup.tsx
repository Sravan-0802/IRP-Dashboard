import { Calendar, Clock, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GenAiTrainingPopupConfig } from "@/lib/useGenAiTrainingConfig";

export function GenAiTrainingPopup({
  open,
  onOpenChange,
  content,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: GenAiTrainingPopupConfig;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-[rgba(103,65,217,0.15)] p-0 sm:rounded-2xl">
        <div
          className="px-6 pb-2 pt-6"
          style={{
            background: "linear-gradient(135deg, #53389e 0%, #6941c6 45%, #7f56d9 100%)",
          }}
        >
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" />
            Live sessions
          </div>
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="font-display text-lg font-extrabold leading-snug text-white sm:text-xl">
              {content.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/85">
              {content.body}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5">
          <div className="flex items-start gap-3 rounded-xl border border-[rgba(103,65,217,0.12)] bg-[rgba(103,65,217,0.04)] px-4 py-3">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <p className="text-sm font-semibold text-ink">{content.schedule}</p>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-[rgba(103,65,217,0.12)] bg-[rgba(103,65,217,0.04)] px-4 py-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
            <p className="text-sm font-semibold text-ink">{content.time}</p>
          </div>
          <p className="text-center text-sm font-bold text-[#6941c6]">{content.footer}</p>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-[rgba(103,65,217,0.08)] bg-[#faf9ff] px-6 py-4 sm:flex-col sm:space-x-0">
          <a
            href={content.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pop inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold"
          >
            {content.ctaLabel}
          </a>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-muted2 transition-colors hover:bg-[rgba(103,65,217,0.06)] hover:text-ink"
          >
            Dismiss
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
