import { LayoutDashboard, BookOpen, CalendarClock, LogOut, Settings, Zap, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Journey } from "@/lib/journey";
import { levelLabel } from "@/lib/journey";

export type PageKey = "dashboard" | "learning" | "slot";

const NAV: { key: PageKey; icon: typeof LayoutDashboard; label: string }[] = [
  { key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { key: "learning", icon: BookOpen, label: "My Learning" },
  { key: "slot", icon: CalendarClock, label: "Book a Slot" },
];

export function SidebarContent({
  name,
  yog,
  journey,
  active,
  onNavigate,
  onOpenSettings,
}: {
  name: string;
  yog: number;
  journey: Journey;
  active: PageKey;
  onNavigate: (key: PageKey) => void;
  onOpenSettings: () => void;
}) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-2 border-b border-[#8a6eff1f] px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#8a6eff] to-[#c45fff] font-display text-sm font-extrabold text-white">
          IRP
        </div>
        <span className="font-display text-lg font-extrabold tracking-tight text-[#e8e6ff]">2.0</span>
      </div>

      <div className="border-b border-[#8a6eff1f] px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8a6eff] to-[#c45fff] text-sm font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#e8e6ff]">{name}</p>
            <p className="text-xs font-medium text-[#7a6eaa]">YOG {yog}</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-[#4a4060]" />
        </div>
        {journey.isWildcard ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-gradient-to-r from-[#ff6eb4] to-[#c45fff] px-3 py-1.5 text-xs font-bold text-white">
            <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Wildcard · Direct L3</span>
          </div>
        ) : (
          <div className="mt-2 rounded-lg bg-[#8a6eff]/15 px-3 py-1.5 text-xs font-bold text-[#b9a7ff]">
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
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all",
              active === key
                ? "bg-[#8a6eff]/15 text-[#c9bdff]"
                : "text-[#7a6eaa] hover:bg-white/[0.04] hover:text-[#cfc7ee]",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-[#8a6eff1f] px-3 py-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#7a6eaa] transition-colors hover:bg-white/[0.04] hover:text-[#cfc7ee]"
        >
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#ff7a9c] transition-colors hover:bg-[#ff6eb4]/10"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );
}
