import { LayoutDashboard, ClipboardList, CalendarClock, Zap, Mail } from "lucide-react";
import { FeedbackButton } from "./FeedbackButton";
import { cn } from "@/lib/utils";
import type { Journey } from "@/lib/journey";
import { levelLabel, getLevel } from "@/lib/journey";

const LEVEL_COLOR: Record<1 | 2 | 3, string> = {
  1: "#3b5bdb",
  2: "#f59f00",
  3: "#e64980",
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
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-[#6741d9]/10 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b5bdb] to-[#6741d9] font-display text-[11px] font-extrabold text-white">
          IRP
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-extrabold tracking-tight text-[#0d1117]">IRP 2.0</p>
          <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-[#6741d9]/70">Internship Readiness</p>
        </div>
      </div>

      <div className="border-b border-[#6741d9]/10 px-4 py-4">
        <div className="flex items-center gap-3 rounded-[10px] border border-[#3b5bdb]/15 bg-[#eef2ff] p-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b5bdb] to-[#6741d9] text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#0d1117]">{name}</p>
            <p className="text-[10px] font-medium text-[#6e6a8a]">YOG {yog}</p>
          </div>
        </div>
        {journey.isWildcard ? (
          <div className="mt-2 flex items-center justify-between rounded-[9px] bg-gradient-to-r from-[#9c36b5] to-[#e64980] px-3 py-1.5 text-xs font-bold text-white">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Wildcard · Direct L3</span>
          </div>
        ) : (
          <div
            className="mt-2 rounded-[9px] px-3 py-1.5 text-xs font-bold text-white"
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
              "flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b5bdb]/50",
              active === key
                ? "border-[1.5px] border-[#3b5bdb]/[0.18] bg-[#eef2ff] text-[#3b5bdb]"
                : "border-[1.5px] border-transparent text-[#6e6a8a] hover:bg-[#6741d9]/[0.05] hover:text-[#0d1117]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="space-y-2 border-t border-[#6741d9]/10 px-3 py-3">
        <button
          type="button"
          onClick={onOpenContact}
          className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-xs font-semibold text-[#6e6a8a] transition-colors hover:bg-[#6741d9]/[0.05] hover:text-[#0d1117] focus:outline-none"
        >
          <Mail className="h-4 w-4" /> Help & Support
        </button>
        <FeedbackButton onClick={onOpenFeedback} />
      </div>
    </div>
  );
}
