import { useEffect, useState } from "react";
import { fetchPaymentStatus } from "@/lib/paymentStatusApi";

export function usePaymentStatus() {
  const [paid, setPaid] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPaymentStatus()
      .then((p) => {
        if (!cancelled) setPaid(p);
      })
      .catch(() => {
        // Fail open: never lock out a paying student on a transient error.
        if (!cancelled) setPaid(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { paid, loading };
}
