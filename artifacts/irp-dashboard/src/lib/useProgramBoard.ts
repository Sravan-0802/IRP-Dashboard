import { getGetStudentProgramBoardQueryKey, useGetStudentProgramBoard } from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/authToken";
import { DEFAULT_PROGRAM_BOARD, type ProgramBoard } from "@/lib/programBoard";

/** Student program board cache key (generated). Invalidate this after admin saves. */
export const PROGRAM_BOARD_QUERY_KEY = getGetStudentProgramBoardQueryKey();
export const PROGRAM_BOARD_REFRESH_INTERVAL_MS = 30_000;

/** Explicit bearer header so the local sessionStorage token works even before the global getter is set. */
function studentAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function useProgramBoardQuery() {
  return useGetStudentProgramBoard<ProgramBoard>({
    query: {
      queryKey: PROGRAM_BOARD_QUERY_KEY,
      staleTime: 0,
      refetchInterval: PROGRAM_BOARD_REFRESH_INTERVAL_MS,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: 1,
      select(data) {
        if (!data?.genai || !Array.isArray(data?.calendar?.events) || !Array.isArray(data?.calendar?.upcoming)) {
          throw new Error("Program board response is incomplete");
        }
        return data;
      },
    },
    request: { cache: "no-store", headers: studentAuthHeaders() },
  });
}

export function useProgramBoard(): ProgramBoard {
  const query = useProgramBoardQuery();
  return query.data ?? DEFAULT_PROGRAM_BOARD;
}
