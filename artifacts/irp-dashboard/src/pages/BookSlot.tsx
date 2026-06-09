import { useState } from "react";
import { BellRing, Check } from "lucide-react";

// Slots are not released yet in this build — show the notify-me flow.
const SLOTS_RELEASED = false;

export function BookSlot() {
  const [number, setNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Book a Slot</h1>
        <p className="mt-1 text-sm text-muted2">Reserve your assessment slot once booking opens.</p>
      </div>

      {!SLOTS_RELEASED ? (
        <>
          <div
            className="rounded-2xl border border-[rgba(103,65,217,0.15)] p-8 text-center shadow-soft"
            style={{ background: "linear-gradient(130deg, #eef2ff, #f8f0ff)" }}
          >
            <div className="text-5xl">🗓️</div>
            <h2 className="mt-3 font-display text-xl font-extrabold text-ink">Slot booking opens soon</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted2">
              We'll notify you the moment slots go live. Drop your WhatsApp number and we'll ping you.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(59,91,219,0.18)] bg-l1-bg px-3 py-1 text-xs font-bold text-l1">
              ⏳ Coming soon
            </span>
          </div>

          <div className="rounded-2xl border border-[rgba(59,91,219,0.15)] bg-white p-5 shadow-soft sm:p-6">
            <h3 className="font-display text-base font-extrabold text-ink">Get notified</h3>
            <p className="mt-1 text-sm text-muted2">
              We'll send you a WhatsApp message the moment booking opens.
            </p>

            {submitted ? (
              <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[rgba(12,166,120,0.25)] bg-[#d3f9d8] px-4 py-2.5 text-sm font-bold text-teal">
                <Check className="h-4 w-4" /> You're on the list!
              </div>
            ) : (
              <form
                className="mt-5 flex max-w-md flex-col gap-3 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (number.trim()) setSubmitted(true);
                }}
              >
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  inputMode="tel"
                  placeholder="WhatsApp number"
                  className="flex-1 rounded-lg border border-[rgba(103,65,217,0.15)] bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-l1"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-lg bg-l1 px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  <BellRing className="h-4 w-4" /> Notify me
                </button>
              </form>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted2">Slot grid would render here.</p>
      )}
    </div>
  );
}
