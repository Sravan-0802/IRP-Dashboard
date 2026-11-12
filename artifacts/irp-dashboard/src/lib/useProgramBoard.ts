import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/authToken";
import { DEFAULT_PROGRAM_BOARD, type ProgramBoard } from "@/lib/programBoard";

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

export function useProgramBoard(): ProgramBoard {
  const query = useQuery({
    queryKey: ["student", "program-board"],
    queryFn: fetchProgramBoard,
    staleTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
  return query.data ?? DEFAULT_PROGRAM_BOARD;
}
