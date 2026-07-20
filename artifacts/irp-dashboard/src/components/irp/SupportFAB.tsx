import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { getAuthToken } from "@/lib/authToken";

const STORAGE_KEY = "support_chat_last_opened";
const POLL_INTERVAL = 30_000;

type Message = {
  id: number;
  senderType: "student" | "admin" | "bot";
  createdAt: string;
};

function getLastOpened(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

export function markSupportChatOpened() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function SupportFAB({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const [unread, setUnread] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkUnread = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch("/api/support/conversation", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: Message[] };
      const lastOpened = getLastOpened();
      const count = (data.messages ?? []).filter(
        (m) =>
          (m.senderType === "admin" || m.senderType === "bot") &&
          new Date(m.createdAt).getTime() > lastOpened,
      ).length;
      setUnread(count);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void checkUnread();
    intervalRef.current = setInterval(() => void checkUnread(), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkUnread]);

  useEffect(() => {
    if (open) {
      markSupportChatOpened();
      setUnread(0);
    }
  }, [open]);

  return (
    <button
      type="button"
      aria-label={open ? "Close support chat" : "Open support chat"}
      onClick={onToggle}
      className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#3b5bdb] to-[#6741d9] shadow-lg shadow-[rgba(103,65,217,0.40)] transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-[rgba(103,65,217,0.50)] active:scale-95"
    >
      <MessageCircle className="h-6 w-6 text-white" strokeWidth={2} />

      {unread > 0 && !open && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f03e3e] text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
