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
        aria-label="Feedback"
        title="Feedback"
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border border-[#eaecf0] bg-white text-[#344054] shadow-sm transition-colors hover:bg-[#f9fafb] hover:text-[#6941c6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]/30",
          className,
        )}
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#667085] transition-colors hover:bg-[#f9fafb] hover:text-[#344054] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]/30",
        className,
      )}
    >
      <MessageCircle className="h-4 w-4 shrink-0" />
      Feedback
    </button>
  );
}
