// Slots are not released yet in this build — show coming soon state.
const SLOTS_RELEASED = false;

export function BookSlot() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Book a Slot</h1>
        <p className="mt-1 text-sm text-muted2">Reserve your assessment slot once booking opens.</p>
      </div>

      {!SLOTS_RELEASED ? (
        <div
          className="rounded-2xl border border-[rgba(103,65,217,0.15)] p-8 text-center shadow-soft"
          style={{ background: "linear-gradient(130deg, #eef2ff, #f8f0ff)" }}
        >
          <div className="text-5xl">🗓️</div>
          <h2 className="mt-3 font-display text-xl font-extrabold text-ink">Slot booking opens soon</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted2">
            We'll notify you when the Assessment Selection and Slot Selection Feature goes live.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[rgba(59,91,219,0.18)] bg-l1-bg px-3 py-1 text-xs font-bold text-l1">
            ⏳ Coming soon
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted2">Slot grid would render here.</p>
      )}
    </div>
  );
}
