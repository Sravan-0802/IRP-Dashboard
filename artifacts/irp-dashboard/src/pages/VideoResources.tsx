import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Play, X } from "lucide-react";
import {
  VIDEO_FILTERS,
  VIDEO_RESOURCES,
  drivePreviewUrl,
  showSection,
  type VideoFilter,
  type VideoResource,
} from "@/lib/videoResources";
import {
  VIDEO_RESOURCE_EVENTS,
  createVideoResourceSessionId,
  trackVideoResourceEvent,
} from "@/lib/videoResourceAnalytics";

function openExternal(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function VideoResources() {
  const [filter, setFilter] = useState<VideoFilter>("all");
  const sessionIdRef = useRef(createVideoResourceSessionId());

  useEffect(() => {
    trackVideoResourceEvent({
      eventType: VIDEO_RESOURCE_EVENTS.PAGE_OPEN,
      sessionId: sessionIdRef.current,
    });
  }, []);

  const howto = useMemo(
    () => VIDEO_RESOURCES.filter((item) => item.filter === "howto"),
    [],
  );
  const mentorship = useMemo(
    () => VIDEO_RESOURCES.filter((item) => item.filter === "mentorship"),
    [],
  );

  function onFilterChange(next: VideoFilter) {
    setFilter(next);
    trackVideoResourceEvent({
      eventType: VIDEO_RESOURCE_EVENTS.FILTER_CHANGE,
      resourceId: next,
      sessionId: sessionIdRef.current,
    });
  }

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
              onClick={() => onFilterChange(tab.id)}
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
              <HowToCard key={item.id} item={item} sessionId={sessionIdRef.current} />
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
              <MentorshipCard key={item.id} item={item} sessionId={sessionIdRef.current} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function HowToCard({ item, sessionId }: { item: VideoResource; sessionId: string }) {
  const [open, setOpen] = useState(false);
  const streamUrl = drivePreviewUrl(item.url);

  function startPlayback() {
    trackVideoResourceEvent({
      eventType: VIDEO_RESOURCE_EVENTS.WATCH_CLICK,
      resourceId: item.id,
      sessionId,
    });
    if (streamUrl) {
      setOpen(true);
      return;
    }
    openExternal(item.url);
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-stretch">
          <button
            type="button"
            onClick={startPlayback}
            className="relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border border-[#e4e7ec] bg-[linear-gradient(180deg,#f9fafb_0%,#f2f4f7_100%)] p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6941c6]/40 sm:min-h-[280px] sm:p-6"
            data-testid={`howto-thumb-${item.id}`}
          >
            <div className="relative z-10 flex items-start justify-between gap-3">
              <span className="inline-flex rounded-full border border-[#d6bbfb] bg-white/80 px-2.5 py-1 text-[10px] font-bold tracking-[0.06em] text-[#6941c6]">
                GENAI TRACK · VIDEO GUIDE
              </span>
              <span className="rounded-full bg-[#344054] px-2 py-0.5 text-[11px] font-bold text-white">
                {item.durationLabel ?? "Video"}
              </span>
            </div>

            <h3 className="relative z-10 mt-5 max-w-[16rem] font-display text-2xl font-extrabold leading-tight tracking-tight text-[#101828] sm:text-[28px]">
              <LoomTitleHighlight title={item.title} />
            </h3>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="absolute h-36 w-36 rounded-full bg-[#e9d7fe]/70 sm:h-44 sm:w-44" aria-hidden />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#6941c6] text-white shadow-[0_10px_24px_rgba(105,65,198,0.35)]">
                <Play className="h-6 w-6 fill-current" aria-hidden />
              </span>
            </div>

            <div className="relative z-10 mt-auto pt-16">
              <div className="flex flex-wrap gap-2">
                {["1 Record", "2 Make link public", "3 Submit on dashboard"].map((step) => (
                  <span
                    key={step}
                    className="rounded-full border border-[#eaecf0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344054]"
                  >
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </button>

          <div className="flex flex-col justify-center px-1 py-2 sm:px-3 sm:py-4 lg:pr-2">
            <span className="inline-flex w-fit rounded-full bg-[#f4f3ff] px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#6941c6]">
              VIDEO GUIDE
            </span>
            <h3 className="mt-3 font-display text-xl font-extrabold tracking-tight text-[#101828]">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#667085]">{item.description}</p>
            <button
              type="button"
              onClick={startPlayback}
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-[#6941c6] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]"
              data-testid={`howto-watch-${item.id}`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
                <Play className="h-3 w-3 fill-current" aria-hidden />
              </span>
              Watch now
            </button>
          </div>
        </div>
      </article>

      {open && streamUrl ? (
        <VideoPopup
          title={item.title}
          resourceId={item.id}
          sessionId={sessionId}
          streamUrl={streamUrl}
          originalUrl={item.url}
          onClose={() => setOpen(false)}
          testId={`howto-popup-${item.id}`}
        />
      ) : null}
    </>
  );
}

function LoomTitleHighlight({ title }: { title: string }) {
  const highlight = "Loom video";
  const index = title.indexOf(highlight);
  if (index < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, index)}
      <span className="text-[#6941c6]">{highlight}</span>
      {title.slice(index + highlight.length)}
    </>
  );
}

function VideoPopup({
  title,
  resourceId,
  sessionId,
  streamUrl,
  originalUrl,
  onClose,
  testId,
}: {
  title: string;
  resourceId: string;
  sessionId: string;
  streamUrl: string;
  originalUrl: string;
  onClose: () => void;
  testId: string;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function handleClose() {
    // Google Drive's cross-origin player does not expose playback progress.
    trackVideoResourceEvent({
      eventType: VIDEO_RESOURCE_EVENTS.CLOSE,
      resourceId,
      sessionId,
      watchSeconds: null,
      durationSeconds: null,
    });
    onCloseRef.current();
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        trackVideoResourceEvent({
          eventType: VIDEO_RESOURCE_EVENTS.CLOSE,
          resourceId,
          sessionId,
          watchSeconds: null,
          durationSeconds: null,
        });
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [resourceId, sessionId]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] box-border flex items-center justify-center bg-black/65 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid={testId}
      onClick={handleClose}
    >
      <div
        className="box-border flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-[#101828] shadow-xl"
        style={{ maxHeight: "min(88dvh, 100%)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-4">
          <h2 className="min-w-0 flex-1 truncate font-display text-sm font-bold text-white sm:text-base">
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20"
            data-testid={`${testId}-close`}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto bg-black">
          <iframe
            title={title}
            src={streamUrl}
            className="block aspect-video max-h-[65dvh] w-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            data-testid={`${testId}-video`}
          />
            <div className="px-4 py-3 text-center text-sm text-white/80">
              Trouble playing?{" "}
              <a
                href={originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#c3b5fd] underline"
              >
                Open in a new tab
              </a>
            </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MentorshipCard({
  item,
  sessionId,
}: {
  item: VideoResource;
  sessionId: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-[#eaecf0] bg-white p-4">
      <span className="inline-flex w-fit rounded-md bg-[#f4f3ff] px-2 py-1 text-[10px] font-bold tracking-wide text-[#6941c6]">
        ASK AN ACHIEVER
      </span>
      <h3 className="mt-3 font-display text-base font-extrabold text-[#101828]">{item.title}</h3>
      <p className="mt-1 flex-1 text-sm text-[#667085]">{item.description}</p>
      <button
        type="button"
        onClick={() => {
          trackVideoResourceEvent({
            eventType: VIDEO_RESOURCE_EVENTS.MENTORSHIP_OPEN,
            resourceId: item.id,
            sessionId,
          });
          openExternal(item.url);
        }}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#6941c6] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#5925dc]"
        data-testid={`mentorship-open-${item.id}`}
      >
        Open event page
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </article>
  );
}
