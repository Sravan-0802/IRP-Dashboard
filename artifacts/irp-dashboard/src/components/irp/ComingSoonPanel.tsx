import { CalendarClock } from "lucide-react";
import { IrpCard } from "./ui";

export function ComingSoonPanel({
  title = "Coming soon",
  description = "This section will open when the next assessment cycle is announced. Check back here for slot registration and calendar updates.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <IrpCard className="flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef2ff] text-brand">
        <CalendarClock className="h-7 w-7" />
      </div>
      <h2 className="font-display text-xl font-extrabold text-ink sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted2">{description}</p>
    </IrpCard>
  );
}
