/** Google Form for unpaid students to report payment concerns. */
export const PAYMENT_CONCERNS_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSclDxqCDijga_6ZGUTtnNvWZ7q6sX7t5AQW7u6C1wvJHPXzXQ/viewform";

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
        <a
          href={PAYMENT_CONCERNS_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-pop mt-6 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold"
        >
          Payment concerns form
        </a>
        <p className="mx-auto mt-3 max-w-sm text-xs text-dim">
          Already paid, or need help with payment? Submit the form above so our
          team can assist you.
        </p>
      </div>
    </div>
  );
}

export default PaymentRequired;
