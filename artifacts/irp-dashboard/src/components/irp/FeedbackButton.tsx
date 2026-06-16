import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeedbackButton({
  onClick,
  className,
  variant = "sidebar",
}: {
  onClick: () => void;
  className?: string;
  variant?: "sidebar" | "floating";
}) {
  if (variant === "floating") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="We value your feedback"
        className={cn(
          "fixed right-0 top-1/2 z-[90] flex -translate-y-1/2 items-center gap-2 rounded-l-full bg-[#f97316] py-3 pl-3 pr-2 text-[11px] font-bold text-white shadow-[0_4px_20px_rgba(249,115,22,0.45)] transition-colors hover:bg-[#ea580c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]/60",
          className,
        )}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/90">
          <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="hidden max-w-[4.5rem] leading-tight sm:block">
          We value your feedback
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-full bg-[#f97316] px-3 py-2.5 text-[11px] font-bold leading-tight text-white shadow-sm transition-colors hover:bg-[#ea580c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]/50",
        className,
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/90">
        <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      We value your feedback
    </button>
  );
}
