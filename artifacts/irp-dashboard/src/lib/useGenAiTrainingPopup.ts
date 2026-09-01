import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "irp-genai-training-popup-dismissed";

function storageKey(userId: string, version: string): string {
  return `${STORAGE_PREFIX}:${userId}:${version}`;
}

function isDismissed(userId: string, version: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId, version)) === "1";
  } catch {
    return false;
  }
}

function markDismissed(userId: string, version: string): void {
  try {
    localStorage.setItem(storageKey(userId, version), "1");
  } catch {
    // ignore — pop-up may reappear next visit
  }
}

type Options = {
  enabled?: boolean;
  version?: string;
};

/** Show once per login until the student dismisses (persisted per user + campaign version). */
export function useGenAiTrainingPopup(
  userId: string | null | undefined,
  { enabled = false, version = "2026-09" }: Options = {},
) {
  const [open, setOpen] = useState(false);
  const openedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      setOpen(false);
      openedForUserRef.current = null;
      return;
    }
    const sessionKey = `${userId}:${version}`;
    if (openedForUserRef.current === sessionKey) return;
    openedForUserRef.current = sessionKey;
    setOpen(!isDismissed(userId, version));
  }, [userId, enabled, version]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next && userId) markDismissed(userId, version);
      setOpen(next);
    },
    [userId, version],
  );

  return { open, onOpenChange };
}
