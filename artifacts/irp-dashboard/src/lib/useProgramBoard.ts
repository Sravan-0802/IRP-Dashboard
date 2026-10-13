import { useEffect, useState } from "react";
import { DEFAULT_PROGRAM_BOARD, type ProgramBoard } from "@/lib/programBoard";

export function useProgramBoard(): ProgramBoard {
  const [board, setBoard] = useState<ProgramBoard>(DEFAULT_PROGRAM_BOARD);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/student/program-board")
      .then(async (res) => (res.ok ? ((await res.json()) as ProgramBoard) : null))
      .then((data) => {
        if (cancelled || !data?.genai || !data.calendar) return;
        setBoard(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return board;
}