import { useEffect, useState } from "react";
import { L1_CYCLE } from "@/lib/l1AssessmentSchedule";
import { fetchL1ExamAccess, type L1ExamAccess } from "@/lib/l1ExamAccessApi";

export function useL1ExamAccess(cycle = L1_CYCLE) {
  const [examAccess, setExamAccess] = useState<L1ExamAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchL1ExamAccess(cycle)
      .then((access) => {
        if (!cancelled) setExamAccess(access);
      })
      .catch(() => {
        if (!cancelled) setExamAccess(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cycle]);

  return { examAccess, loading };
}
