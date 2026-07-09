import { useEffect, useState } from "react";
import { fetchL1July12CohortStatus } from "@/lib/l1July12Api";

export function useL1July12Cohort() {
  const [registered, setRegistered] = useState(false);
  const [registrationUnlocked, setRegistrationUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchL1July12CohortStatus()
      .then((status) => {
        if (!cancelled) {
          setRegistered(status.registered);
          setRegistrationUnlocked(status.registrationUnlocked);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegistered(false);
          setRegistrationUnlocked(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { registered, registrationUnlocked, loading };
}
