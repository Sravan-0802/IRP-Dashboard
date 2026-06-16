import { useState } from "react";
import { CheckCircle2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/authToken";
import { feedbackTierForRating, pickFeedbackQuestion, type FeedbackRating } from "@/lib/feedbackQuestions";

function StarRating({
  value,
  onChange,
}: {
  value: FeedbackRating | null;
  onChange: (rating: FeedbackRating) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;

  return (
    <div
      className="flex justify-center gap-1.5 py-4 sm:gap-2"
      onMouseLeave={() => setHover(null)}
    >
      {([1, 2, 3, 4, 5] as FeedbackRating[]).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="rounded-lg p-0.5 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/50"
        >
          <Star
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-10",
              n <= active
                ? "fill-[#c4b5fd] text-[#a78bfa]"
                : "fill-none text-[#cbd5e1]",
            )}
            strokeWidth={1.75}
          />
        </button>
      ))}
    </div>
  );
}

export function FeedbackSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (!open) return null;

  const tier = rating ? feedbackTierForRating(rating) : null;

  function close() {
    setRating(null);
    setQuestion(null);
    setAnswer("");
    setStatus("idle");
    setError("");
    onClose();
  }

  function selectRating(next: FeedbackRating) {
    const nextTier = feedbackTierForRating(next);
    setRating(next);
    setQuestion(pickFeedbackQuestion(nextTier));
    setAnswer("");
    if (status === "error") setStatus("idle");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating || !tier || !question) return;

    const trimmed = answer.trim();
    if (!trimmed) {
      setStatus("error");
      setError("Please answer the question.");
      return;
    }

    setStatus("sending");
    setError("");

    try {
      const token = getAuthToken();
      const res = await fetch("/api/student/feedback", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          rating,
          label: tier.label,
          answers: [{ question, answer: trimmed }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close feedback"
        className="absolute inset-0 bg-[rgba(13,17,23,0.4)] backdrop-blur-[3px]"
        onClick={close}
      />

      <div className="relative w-full max-w-[520px] rounded-2xl border border-[rgba(103,65,217,0.1)] bg-white px-6 py-7 shadow-[0_24px_60px_rgba(103,65,217,0.18)] sm:px-8 sm:py-8">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-lg p-1 text-muted2 hover:bg-[rgba(103,65,217,0.06)]"
        >
          <X className="h-4 w-4" />
        </button>

        {status === "sent" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-teal" />
            <p className="font-display text-lg font-extrabold text-ink">Thank you!</p>
            <p className="text-sm text-muted2">Your feedback helps us improve the IRP dashboard.</p>
            <button
              type="button"
              onClick={close}
              className="mt-3 w-full rounded-full bg-gradient-to-r from-[#c4b5fd] via-[#ddd6fe] to-[#e9d5ff] px-6 py-3.5 text-sm font-bold text-[#5b21b6] hover:opacity-95"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a78bfa]">
              Feedback
            </p>
            <h2 className="mt-2 pr-6 font-display text-xl font-extrabold leading-snug text-ink sm:text-[1.35rem]">
              Was this dashboard helpful for you?
            </h2>
            <p className="mt-1.5 text-sm text-muted2">Your answer is required.</p>

            <StarRating value={rating} onChange={selectRating} />

            <div className="rounded-xl border border-[rgba(103,65,217,0.12)] bg-[#fafafa] px-4 py-3">
              {!tier || !question ? (
                <p className="py-10 text-center text-sm text-[#94a3b8]">Select a rating to continue.</p>
              ) : (
                <div className="py-1">
                  <p className="text-xs font-bold text-[#7c3aed]">
                    {tier.stars} {tier.label}
                  </p>
                  <label className="mb-1.5 mt-3 block text-xs font-semibold text-ink2">
                    {question}
                  </label>
                  <textarea
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    rows={3}
                    maxLength={1000}
                    disabled={status === "sending"}
                    className="w-full resize-none rounded-lg border border-[rgba(103,65,217,0.12)] bg-white px-3 py-2 text-sm text-ink placeholder:text-muted2 focus:border-[#a78bfa] focus:outline-none focus:ring-2 focus:ring-[rgba(167,139,250,0.2)] disabled:opacity-60"
                  />
                </div>
              )}
            </div>

            {status === "error" && error && (
              <p className="mt-3 text-xs font-semibold text-[#c2255c]">{error}</p>
            )}

            <button
              type="submit"
              disabled={!rating || status === "sending"}
              className="mt-5 w-full rounded-full bg-gradient-to-r from-[#c4b5fd] via-[#ddd6fe] to-[#e9d5ff] px-6 py-3.5 text-sm font-bold text-[#5b21b6] shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {status === "sending" ? "Submitting…" : "Submit Feedback"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
