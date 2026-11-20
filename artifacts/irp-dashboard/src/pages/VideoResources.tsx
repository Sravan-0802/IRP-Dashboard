import { useMemo, useState } from "react";
import { ArrowUpRight, Play } from "lucide-react";
import {
  VIDEO_FILTERS,
  VIDEO_RESOURCES,
  showSection,
  type VideoFilter,
  type VideoResource,
} from "@/lib/videoResources";

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function VideoResources() {
  const [filter, setFilter] = useState<VideoFilter>("all");

  const howto = useMemo(
    () => VIDEO_RESOURCES.filter((item) => item.filter === "howto"),
    [],
  );
  const mentorship = useMemo(
    () => VIDEO_RESOURCES.filter((item) => item.filter === "mentorship"),
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-[#6941c6]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6941c6]" aria-hidden />
          RESOURCE HUB
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#101828] sm:text-[28px]">
          Video Resources
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[#667085]">
          How-to guides and mentorship sessions, all in one place.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Video resource filters"
      >
        {VIDEO_FILTERS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={
                active
                  ? "rounded-full bg-[#101828] px-3.5 py-1.5 text-sm font-semibold text-white"
                  : "rounded-full border border-[#eaecf0] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#344054] hover:bg-[#f9fafb]"
              }
              data-testid={`filter-${tab.id}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {showSection(filter, "howto") ? (
        <section className="space-y-3" aria-labelledby="howto-heading">
          <div>
            <h2 id="howto-heading" className="font-display text-lg font-extrabold text-[#101828]">
              How-to guides
            </h2>
            <p className="text-sm text-[#667085]">Short walkthroughs for common IRP steps.</p>
          </div>
          <div className="space-y-3">
            {howto.map((item) => (
              <HowToCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {showSection(filter, "mentorship") ? (
        <section className="space-y-3" aria-labelledby="mentorship-heading">
          <div>
            <h2 id="mentorship-heading" className="font-display text-lg font-extrabold text-[#101828]">
              Mentorship
            </h2>
            <p className="text-sm text-[#667085]">Ask An Achiever sessions on the CCBP Learning Portal.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mentorship.map((item) => (
              <MentorshipCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HowToCard({ item }: { item: VideoResource }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => openExternal(item.url)}
          className="relative min-h-[200px] overflow-hidden bg-[linear-gradient(135deg,#f4f3ff_0%,#e9d7fe_45%,#d6bbfb_100%)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#6941c6]"
          data-testid={`howto-thumb-${item.id}`}
        >
          <div className="absolute inset-0 opacity-40">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#9e77ed]/50" />
            <div className="absolute bottom-6 right-10 h-24 w-24 rounded-full bg-[#7f56d9]/35" />
          </div>
          <div className="relative flex h-full flex-col justify-between p-5">
            <div>
              <p className="text-[11px] font-bold tracking-[0.08em] text-[#6941c6]">
                GENAI TRACK · VIDEO GUIDE
              </p>
              <h3 className="mt-2 max-w-sm font-display text-xl font-extrabold text-[#101828]">
                {item.title}
              </h3>
              <ol className="mt-3 space-y-1 text-sm font-medium text-[#344054]">
                <li>1 Record</li>
                <li>2 Make link public</li>
                <li>3 Submit on dashboard</li>
              </ol>
            </div>
            <p className="text-xs font-semibold text-[#667085]">Submit by Sat, 21 Nov 2026</p>
          </div>
          <span className="absolute bottom-3 right-3 rounded bg-[#101828] px-1.5 py-0.5 text-[11px] font-bold text-white">
            {item.durationLabel ?? "Video"}
          </span>
          <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#6941c6] shadow-sm">
            <Play className="h-5 w-5 fill-current" aria-hidden />
          </span>
        </button>

        <div className="flex flex-col justify-center p-5 sm:p-6">
          <span className="inline-flex w-fit rounded-md bg-[#f4f3ff] px-2 py-1 text-[10px] font-bold tracking-wide text-[#6941c6]">
            VIDEO GUIDE
          </span>
          <h3 className="mt-3 font-display text-lg font-extrabold text-[#101828]">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#667085]">{item.description}</p>
          <button
            type="button"
            onClick={() => openExternal(item.url)}
            className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-[#6941c6] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]"
            data-testid={`howto-watch-${item.id}`}
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
            Watch now
          </button>
        </div>
      </div>
    </article>
  );
}

function MentorshipCard({ item }: { item: VideoResource }) {
  return (
    <article className="flex flex-col rounded-2xl border border-[#eaecf0] bg-white p-4">
      <span className="inline-flex w-fit rounded-md bg-[#f4f3ff] px-2 py-1 text-[10px] font-bold tracking-wide text-[#6941c6]">
        ASK AN ACHIEVER
      </span>
      <h3 className="mt-3 font-display text-base font-extrabold text-[#101828]">{item.title}</h3>
      <p className="mt-1 flex-1 text-sm text-[#667085]">{item.description}</p>
      <button
        type="button"
        onClick={() => openExternal(item.url)}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6941c6] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]"
        data-testid={`mentorship-open-${item.id}`}
      >
        Open event page
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </article>
  );
}
