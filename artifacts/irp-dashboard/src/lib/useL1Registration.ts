import { useCallback, useEffect, useState } from "react";
import type { L1RegistrationRecord } from "@/lib/l1AssessmentSchedule";
import { L1_CYCLE } from "@/lib/l1AssessmentSchedule";
import { fetchL1Registration, submitL1Registration } from "@/lib/l1RegistrationApi";

export function useL1Registration(cycle = L1_CYCLE) {
  const [registration, setRegistration] = useState<L1RegistrationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reg = await fetchL1Registration(cycle);
      setRegistration(reg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load registration");
      setRegistration(null);
    } finally {
      setLoading(false);
    }
  }, [cycle]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(
    async (record: L1RegistrationRecord) => {
      setSubmitting(true);
      setError(null);
      try {
        const saved = await submitL1Registration(record, cycle);
        setRegistration(saved);
        return saved;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Registration failed";
        setError(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [cycle],
  );

  return {
    registration,
    loading,
    submitting,
    error,
    refresh,
    submit,
    isSubmitted: registration !== null,
  };
}
