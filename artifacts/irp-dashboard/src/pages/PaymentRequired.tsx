export function PaymentRequired() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-2xl border border-[rgba(103,65,217,0.16)] p-8 text-center shadow-soft"
        style={{ background: "linear-gradient(130deg, #eef2ff, #f8f0ff)" }}
      >
        <div className="text-5xl">💳</div>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">
          Please complete your payment
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted2">
          Your dashboard will be unlocked once your payment is complete. Please
          complete your payment and visit the dashboard.
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xs text-dim">
          If you have already paid and still see this message, please contact
          your program coordinator.
        </p>
      </div>
    </div>
  );
}

export default PaymentRequired;
