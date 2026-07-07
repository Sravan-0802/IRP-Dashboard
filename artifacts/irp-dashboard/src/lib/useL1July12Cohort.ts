import { useEffect, useState } from "react";
import { fetchL1July12Registered } from "@/lib/l1July12Api";

export function useL1July12Cohort() {
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchL1July12Registered()
      .then((value) => {
        if (!cancelled) setRegistered(value);
      })
      .catch(() => {
        if (!cancelled) setRegistered(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { registered, loading };
}
