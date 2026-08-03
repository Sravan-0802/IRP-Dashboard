import { useEffect, useState } from "react";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/**
 * Live countdown to an ISO expiry timestamp.
 *
 * - `timeLeft`: formatted string ("2h 05m 32s") or "" when no expiry
 * - `isExpired`: true once the clock hits zero
 * - Updates every second while the component is mounted
 */
export function useCountdown(expiresAt: string | null | undefined): {
  timeLeft: string;
  isExpired: boolean;
  hasExpiry: boolean;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return { timeLeft: "", isExpired: false, hasExpiry: false };

  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return { timeLeft: "Expired", isExpired: true, hasExpiry: true };
  return { timeLeft: formatCountdown(remaining), isExpired: false, hasExpiry: true };
}
