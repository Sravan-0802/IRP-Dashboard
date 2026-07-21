import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/authToken";

type SenderType = "student" | "admin" | "bot";

type ChatMessage = {
  id: number;
  senderType: SenderType;
  message: string;
  createdAt: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isStudent = msg.senderType === "student";
  const isAdmin = msg.senderType === "admin";

  return (
    <div className={cn("flex items-end gap-2", isStudent ? "flex-row-reverse" : "flex-row")}>
      {!isStudent && (
        <div
          className={cn(
            "mb-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
            isAdmin
              ? "bg-gradient-to-br from-[#3b5bdb] to-[#6741d9]"
              : "bg-gradient-to-br from-[#0ca678] to-[#099268]",
          )}
        >
          {isAdmin ? "A" : "IRP"}
        </div>
      )}
      <div className={cn("flex max-w-[78%] flex-col gap-0.5", isStudent ? "items-end" : "items-start")}>
        {!isStudent && (
          <span className="ml-0.5 text-[10px] font-semibold text-[#6e6a8a]">
            {isAdmin ? "Support Team" : "IRP Assistant"}
          </span>
        )}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            isStudent
              ? "rounded-tr-sm bg-gradient-to-br from-[#3b5bdb] to-[#6741d9] text-white"
              : isAdmin
                ? "rounded-tl-sm border border-[rgba(103,65,217,0.12)] bg-white text-[#0d1117] shadow-sm"
                : "rounded-tl-sm border border-[rgba(12,166,120,0.2)] bg-[#e8faf4] text-[#0d1117]",
          )}
        >
          {msg.message}
        </div>
        <span className="text-[10px] text-[#6e6a8a]">{formatTime(msg.createdAt)}</span>
      </div>
    </div>
  );
}

export function SupportChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initialLoading, setInitialLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getAuthToken();
    return token ? { authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/support/conversation", {
        headers: { "content-type": "application/json", ...authHeaders() },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { conversation: unknown; messages: ChatMessage[] };
      setMessages(data.messages ?? []);
    } catch {
      // silent — don't disrupt the user
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setInitialLoading(true);
    void fetchMessages().finally(() => setInitialLoading(false));
    intervalRef.current = setInterval(() => void fetchMessages(), 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, fetchMessages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [open, messages.length]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex">
      <button
        type="button"
        aria-label="Close support chat"
        className="absolute inset-0 bg-[rgba(13,17,23,0.30)] backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute bottom-0 right-0 top-0 flex w-full max-w-[420px] flex-col border-l border-[rgba(103,65,217,0.12)] bg-[rgba(255,255,255,0.98)] shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[rgba(103,65,217,0.10)] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3b5bdb] to-[#6741d9] shadow-sm">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-display text-sm font-extrabold text-[#0d1117]">Help & Support</p>
            <p className="text-[11px] text-[#6e6a8a]">Our team typically replies within a few hours</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6e6a8a] transition-colors hover:bg-[#f3f0ff] hover:text-[#3b5bdb]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {initialLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#6741d9]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef2ff]">
                <MessageCircle className="h-7 w-7 text-[#3b5bdb]" />
              </div>
              <div>
                <p className="font-semibold text-[#0d1117]">Hi! How can we help you today?</p>
                <p className="mt-1 text-xs text-[#6e6a8a]">
                  Send us a message and our team will get back to you.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const showDateSep = i === 0 || !isSameDay(msg.createdAt, messages[i - 1].createdAt);
                return (
                  <div key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center gap-2 py-2">
                        <div className="h-px flex-1 bg-[rgba(103,65,217,0.08)]" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6e6a8a]">
                          {formatDateLabel(msg.createdAt)}
                        </span>
                        <div className="h-px flex-1 bg-[rgba(103,65,217,0.08)]" />
                      </div>
                    )}
                    <MessageBubble msg={msg} />
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input — disabled while chatbot is in testing */}
        <div className="shrink-0 border-t border-[rgba(103,65,217,0.10)] px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(103,65,217,0.15)] bg-[#f8f7ff] px-3.5 py-3">
            <Loader2 className="h-4 w-4 shrink-0 text-[#6741d9]" />
            <p className="text-xs text-[#6e6a8a]">
              Chat support is currently in testing and will be available soon.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
