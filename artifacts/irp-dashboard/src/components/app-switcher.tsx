import { LayoutDashboard, Rocket } from "lucide-react";
import { IRP_DASHBOARD_URL, IRP_LANDING_URL } from "@/lib/app-links";

type AppSwitcherProps = {
  active: "landing" | "dashboard";
};

export function AppSwitcher({ active }: AppSwitcherProps) {
  return (
    <div
      className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/80 bg-white/95 p-1 shadow-lg backdrop-blur-md"
      role="navigation"
      aria-label="Switch between IRP apps"
    >
      {active === "landing" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">
          <Rocket className="h-3.5 w-3.5" />
          IRP 2.0
        </span>
      ) : (
        <a
          href={IRP_LANDING_URL}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-gray-500 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Rocket className="h-3.5 w-3.5" />
          IRP 2.0
        </a>
      )}

      {active === "dashboard" ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">
          <LayoutDashboard className="h-3.5 w-3.5" />
          Dashboard
        </span>
      ) : (
        <a
          href={IRP_DASHBOARD_URL}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-gray-500 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Dashboard
        </a>
      )}
    </div>
  );
}
