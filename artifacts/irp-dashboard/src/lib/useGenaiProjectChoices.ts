import { useEffect, useState } from "react";
import { useAcademyUserId } from "@/lib/useAcademyUserId";
import { loadProjectChoices, normalizeProjectChoices, saveProjectChoices } from "./genaiProjectChoices";

export function useGenaiProjectChoices(available: readonly string[]) {
  const userId = useAcademyUserId();
  const [state, setState] = useState<{
    userId: string;
    projects: string[];
    error: string | null;
  }>({ userId: "", projects: [], error: null });

  useEffect(() => {
    if (!userId) return;
    try {
      const projects = loadProjectChoices(window.localStorage, userId, available);
      setState({ userId, projects, error: null });
    } catch {
      setState({
        userId,
        projects: [],
        error: "Saved project choices could not be loaded. Changes may not be kept when you leave.",
      });
    }
  }, [userId, available]);

  const ready = Boolean(userId) && state.userId === userId;

  function setSelectedProjects(projects: string[]) {
    if (!ready) return;
    const next = normalizeProjectChoices(projects, available);
    try {
      saveProjectChoices(window.localStorage, userId, next, available);
      setState({ userId, projects: next, error: null });
    } catch {
      setState({
        userId,
        projects: next,
        error: "Your project choices could not be saved in this browser. They will be lost when you leave.",
      });
    }
  }

  return {
    selectedProjects: ready ? state.projects : [],
    setSelectedProjects,
    choicesReady: ready,
    choicesError: ready ? state.error : null,
  };
}
