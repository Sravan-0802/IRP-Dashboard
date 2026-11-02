import type { DashboardAccessStatus } from "@/lib/paymentStatusApi";

export function PaymentRequired({ statuses }: { statuses: DashboardAccessStatus | null }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-2xl border border-[rgba(103,65,217,0.16)] p-8 shadow-soft"
        style={{ background: "linear-gradient(130deg, #eef2ff, #f8f0ff)" }}
      >
        <h1 className="font-display text-2xl font-extrabold text-ink">Dashboard access is not active</h1>
        <p className="mt-2 text-sm text-muted2">
          Access requires IRP eligibility and active LP and product statuses. Payment status is not used for this check.
        </p>
        <dl className="mt-5 divide-y divide-[#e4def1] rounded-xl bg-white/70 px-4 text-left text-sm">
          {[
            ["IRP eligibility", statuses?.irpEligibleStatus, "ELIGIBLE"],
            ["LP status", statuses?.lpStatus, "ACTIVE"],
            ["Product status", statuses?.productStatus, "ACTIVE"],
          ].map(([label, value, required]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3">
              <dt className="font-semibold text-ink">{label}</dt>
              <dd className="text-right text-muted2">{value ?? "Not available"} <span className="text-dim">(requires {required})</span></dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-dim">If these statuses should be different, contact the IRP team to review your record.</p>
      </div>
    </div>
  );
}

export default PaymentRequired;
