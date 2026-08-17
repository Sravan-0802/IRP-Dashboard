import { LayoutDashboard, ClipboardList, CalendarClock, Zap, Mail, Info } from "lucide-react";
import { FeedbackButton } from "./FeedbackButton";
import { cn } from "@/lib/utils";
import type { Journey } from "@/lib/journey";
import { levelLabel, getLevel } from "@/lib/journey";

const LEVEL_COLOR: Record<1 | 2 | 3, string> = {
  1: "#6941c6",
  2: "#dc6803",
  3: "#d92d20",
};

export type PageKey = "dashboard" | "assessments" | "slot";

const NAV: { key: PageKey; icon: typeof LayoutDashboard; label: string }[] = [
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { key: "assessments", icon: ClipboardList, label: "Assessments Hub" },
  { key: "slot", icon: CalendarClock, label: "Assessment Calendar" },
];

export function SidebarContent({
  name,
  yog,
  journey,
  active,
  onNavigate,
  onOpenFeedback,
  onOpenContact,
}: {
  name: string;
  yog: number;
  journey: Journey;
  active: PageKey;
  onNavigate: (key: PageKey) => void;
  onOpenFeedback: () => void;
  onOpenContact: () => void;
}) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#eaecf0] px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6941c6] font-display text-[11px] font-bold text-white">
          IRP
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold tracking-tight text-[#101828]">IRP 2.0</p>
          <p className="text-[11px] font-medium text-[#667085]">Internship Readiness</p>
        </div>
      </div>

      <div className="border-b border-[#eaecf0] px-4 py-4">
        <div className="flex items-center gap-3 rounded-lg border border-[#eaecf0] bg-[#f9fafb] p-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6941c6] text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#101828]">{name}</p>
            <p className="text-[11px] font-medium text-[#667085]">YOG {yog}</p>
          </div>
        </div>
        {journey.isWildcard ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-[#7f56d9] px-3 py-1.5 text-xs font-semibold text-white">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Wildcard · Direct L3</span>
          </div>
        ) : (
          <div
            className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: LEVEL_COLOR[getLevel(journey.journeyState)] }}
          >
            {levelLabel(journey.journeyState)}
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        {NAV.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]/30",
              active === key
                ? "bg-[#f9f5ff] text-[#6941c6]"
                : "text-[#667085] hover:bg-[#f9fafb] hover:text-[#344054]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
        <a
          href="https://irp-dashboard-academy.replit.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#667085] transition-colors hover:bg-[#f9fafb] hover:text-[#344054]"
        >
          <Info className="h-4 w-4 shrink-0" />
          About
        </a>
      </nav>

      <div className="space-y-2 border-t border-[#eaecf0] px-3 py-3">
        <button
          type="button"
          onClick={onOpenContact}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#667085] transition-colors hover:bg-[#f9fafb] hover:text-[#344054] focus:outline-none"
        >
          <Mail className="h-4 w-4" /> Help & Support
        </button>
        <FeedbackButton onClick={onOpenFeedback} />
      </div>
    </div>
  );
}
