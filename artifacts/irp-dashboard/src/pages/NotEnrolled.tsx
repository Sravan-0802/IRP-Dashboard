export function NotEnrolled({ userId }: { userId?: string | null }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-2xl border border-[rgba(103,65,217,0.16)] p-8 text-center shadow-soft"
        style={{ background: "linear-gradient(130deg, #eef2ff, #f8f0ff)" }}
      >
        <div className="text-5xl">📋</div>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">
          You're not in our data yet
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted2">
          You're signed in, but we couldn't find your IRP assessment records in
          our database. This dashboard is only available for students who have
          taken the IRP assessment.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xs text-dim">
          If you have already written the assessment and still see this message,
          please contact your program coordinator with your reference ID below.
        </p>

        {userId ? (
          <div className="mx-auto mt-5 inline-flex flex-col items-center gap-1 rounded-xl border border-[rgba(103,65,217,0.15)] bg-white/70 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-dim">
              Your reference ID
            </span>
            <span className="select-all break-all font-mono text-xs font-semibold text-ink">
              {userId}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default NotEnrolled;
