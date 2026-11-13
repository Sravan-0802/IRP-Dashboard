import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";
import { DEFAULT_PROGRAM_BOARD, type ProgramBoard } from "@/lib/programBoard";

export const PROGRAM_BOARD_QUERY_KEY = ["student", "program-board"] as const;
export const PROGRAM_BOARD_REFRESH_INTERVAL_MS = 30_000;

async function fetchProgramBoard(): Promise<ProgramBoard> {
  const token = getAuthToken();
  const res = await fetch("/api/student/program-board", {
    cache: "no-store",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Program board request failed (${res.status})`);
  const data = (await res.json()) as ProgramBoard;
  if (!data?.genai || !data.calendar) throw new Error("Program board response is incomplete");
  return data;
}

export function useProgramBoardQuery() {
  return useQuery({
    queryKey: PROGRAM_BOARD_QUERY_KEY,
    queryFn: fetchProgramBoard,
    staleTime: 0,
    refetchInterval: PROGRAM_BOARD_REFRESH_INTERVAL_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useProgramBoard(): ProgramBoard {
  const query = useProgramBoardQuery();
  return query.data ?? DEFAULT_PROGRAM_BOARD;
}
