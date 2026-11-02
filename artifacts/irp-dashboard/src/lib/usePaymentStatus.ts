import { useEffect, useState } from "react";
import { fetchDashboardAccess, type DashboardAccessStatus } from "@/lib/paymentStatusApi";

export function useDashboardAccess() {
  const [access, setAccess] = useState<DashboardAccessStatus | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchDashboardAccess()
      .then((result) => {
        if (!cancelled) setAccess(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { access, error, loading };
}
