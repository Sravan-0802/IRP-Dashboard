import { useState } from "react";
import { CalendarClock, BellRing, Check } from "lucide-react";
import { IrpCard } from "@/components/irp/ui";

// Slots are not released yet in this build — show the notify-me flow.
const SLOTS_RELEASED = false;

export function BookSlot() {
  const [number, setNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-[#e8e6ff] sm:text-3xl">Book a Slot</h1>
        <p className="mt-1 text-sm text-[#7a6eaa]">Reserve your assessment slot once booking opens.</p>
      </div>

      {!SLOTS_RELEASED ? (
        <IrpCard className="p-8 text-center" glow>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8a6eff] to-[#c45fff] text-white">
            <CalendarClock className="h-7 w-7" />
          </div>
          <h2 className="font-display text-xl font-extrabold text-[#e8e6ff]">Slot booking opens soon</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#a99fce]">
            We'll notify you the moment slots go live. Drop your WhatsApp number and we'll ping you.
          </p>

          {submitted ? (
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-xl border border-[#1d9e75]/30 bg-[#1d9e75]/10 px-4 py-2.5 text-sm font-bold text-[#5fe0ad]">
              <Check className="h-4 w-4" /> You're on the list!
            </div>
          ) : (
            <form
              className="mx-auto mt-6 flex max-w-sm flex-col gap-3 sm:flex-row"
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
                className="flex-1 rounded-xl border border-white/10 bg-[#11111f] px-4 py-2.5 text-sm text-[#e8e6ff] outline-none focus:border-[#8a6eff]"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8a6eff] to-[#c45fff] px-4 py-2.5 text-sm font-bold text-white"
              >
                <BellRing className="h-4 w-4" /> Notify me
              </button>
            </form>
          )}
        </IrpCard>
      ) : (
        <p className="text-sm text-[#7a6eaa]">Slot grid would render here.</p>
      )}
    </div>
  );
}
