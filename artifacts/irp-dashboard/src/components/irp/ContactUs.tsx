import { useState } from "react";
import { Mail, Send, CheckCircle2 } from "lucide-react";
import { getAuthToken } from "@/lib/authToken";

export function ContactUs() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;

    setStatus("sending");
    setError("");

    try {
      const token = getAuthToken();
      const res = await fetch("/api/student/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setMessage("");
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div id="contact-us" className="irp-card scroll-mt-24 p-5 sm:p-6">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
          <Mail className="h-4 w-4 text-brand" />
          Contact Us
        </h3>
        <p className="mt-1 text-xs text-muted2">
          Have a question or need help? Send us a message and our team will get back to you.
        </p>
      </div>

      {status === "sent" ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-[rgba(12,166,120,0.25)] bg-[#e8faf0] px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" />
          <p className="text-sm font-semibold text-teal">Message sent. We&apos;ll be in touch soon.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            placeholder="Type your message here…"
            rows={4}
            maxLength={2000}
            disabled={status === "sending"}
            className="w-full resize-none rounded-xl border border-[rgba(103,65,217,0.15)] bg-white px-4 py-3 text-sm text-ink placeholder:text-muted2 focus:border-[#6741d9] focus:outline-none focus:ring-2 focus:ring-[rgba(103,65,217,0.12)] disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted2">{message.length}/2000</span>
            <button
              type="submit"
              disabled={status === "sending" || !message.trim()}
              className="btn-pop flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {status === "sending" ? "Sending…" : "Send Message"}
            </button>
          </div>
          {status === "error" && error && (
            <p className="text-xs font-semibold text-[#c2255c]">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}
