import { useEffect, useState } from "react";
import { fetchL1July26AllowlistStatus } from "@/lib/l1July26Api";

export function useL1July26Allowlist() {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchL1July26AllowlistStatus()
      .then((status) => {
        if (!cancelled) setAllowed(status.allowed);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { allowed, loading };
}
