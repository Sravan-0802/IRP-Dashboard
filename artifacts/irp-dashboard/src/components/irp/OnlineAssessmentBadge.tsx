import { useEffect, useState } from "react";
import { Download, IdCard } from "lucide-react";
import { getAuthToken } from "@/lib/authToken";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POSTER = 1024;

// Measured from the uploaded 1024 posters. The photo sits inside the designed frame.
const PHOTO_X = 618;
const PHOTO_Y = 472;
const PHOTO_W = 299;
const PHOTO_H = 266;
const NAME_X = 620;
const NAME_Y = 812;
const YEAR_Y = 894;
const TEXT_MAX = 292;

/**
 * College year shown under YEAR OF JOIN.
 * YOG is the graduation year, so in the academic year that started this July
 * a 2028 graduate is in 3rd year.
 */
export function formatYearOfJoin(yog: number | null | undefined, now = new Date()): string | null {
  if (yog == null || !Number.isFinite(yog) || yog < 2000 || yog > 2100) return null;
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const year = 4 - (yog - startYear - 1);
  if (year < 1 || year > 4) return null;
  const label = ["", "1ST", "2ND", "3RD", "4TH"][year];
  return `B.TECH ${label} YEAR – ${startYear}`;
}

export type OnlineBadgeStudent = {
  name: string;
  photoUrl: string | null;
  levelLabel: string;
  statusLabel: string;
  yearOfJoin: string | null;
};

export type BadgeThemeId = "online" | "fe" | "panel";

type BadgeTheme = {
  id: BadgeThemeId;
  dialogTitle: string;
  dialogBody: string;
  fileSlug: string;
  template: string;
};

const BADGE_THEMES: Record<BadgeThemeId, BadgeTheme> = {
  online: {
    id: "online",
    dialogTitle: "Online Assessment IRP Clear Card",
    dialogBody: "You qualified in the IRP online assessment. Download this IRP Clear Card to save or share it.",
    fileSlug: "online",
    template: "irp-poster-online.jpg",
  },
  fe: {
    id: "fe",
    dialogTitle: "FE Project IRP Clear Card",
    dialogBody: "You cleared the FE Project. Download this IRP Clear Card to save or share it.",
    fileSlug: "fe",
    template: "irp-poster-fe.jpg",
  },
  panel: {
    id: "panel",
    dialogTitle: "Panel Interview IRP Clear Card",
    dialogBody: "You cleared the panel interview. Download this IRP Clear Card to save or share it.",
    fileSlug: "panel",
    template: "irp-poster-panel.jpg",
  },
};

function asset(file: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${file}`;
}

function todayStamp(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadImage(url: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return "image/webp";
  }
  return null;
}

async function bitmapFromResponse(response: Response): Promise<ImageBitmap | null> {
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  const declared = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const mime = declared.startsWith("image/") ? declared : imageMime(bytes);
  if (!mime) return null;
  try {
    return await createImageBitmap(new Blob([bytes], { type: mime }));
  } catch {
    return null;
  }
}

/** Same-origin bytes first, then the CDN portrait. Either one can be drawn and downloaded. */
async function loadProfilePhoto(photoUrl: string | null): Promise<CanvasImageSource | null> {
  try {
    const token = getAuthToken();
    const proxied = await bitmapFromResponse(
      await fetch("/api/student/profile-photo", {
        cache: "no-store",
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
    );
    if (proxied) return proxied;
  } catch {
    // The API photo can fail in production; the portrait URL is the fallback.
  }

  if (!photoUrl) return null;
  try {
    const remote = await bitmapFromResponse(
      await fetch(photoUrl, { mode: "cors", referrerPolicy: "no-referrer", cache: "no-store" }),
    );
    if (remote) return remote;
  } catch {
    // Some photo hosts block a readable CORS response.
  }

  const displayed = await loadImage(photoUrl);
  if (!displayed) return null;
  try {
    return await createImageBitmap(displayed);
  } catch {
    return displayed;
  }
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  let size = 26;
  let font = `900 ${size}px Inter, sans-serif`;
  ctx.font = font;
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    font = `900 ${size}px Inter, sans-serif`;
    ctx.font = font;
  }
  return font;
}

function drawPoster(
  ctx: CanvasRenderingContext2D,
  student: OnlineBadgeStudent,
  template: HTMLImageElement | null,
  photo: CanvasImageSource | null,
) {
  ctx.clearRect(0, 0, POSTER, POSTER);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, POSTER, POSTER);
  if (template) ctx.drawImage(template, 0, 0, POSTER, POSTER);

  if (photo) {
    const sw = photo instanceof HTMLImageElement ? photo.naturalWidth : photo.width;
    const sh = photo instanceof HTMLImageElement ? photo.naturalHeight : photo.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H);
    ctx.clip();
    const ir = sw / sh;
    const tr = PHOTO_W / PHOTO_H;
    let dw = PHOTO_W;
    let dh = PHOTO_H;
    let dx = PHOTO_X;
    let dy = PHOTO_Y;
    if (ir > tr) {
      dw = PHOTO_H * ir;
      dx = PHOTO_X - (dw - PHOTO_W) / 2;
    } else {
      dh = PHOTO_W / ir;
      dy = PHOTO_Y - (dh - PHOTO_H) * 0.12;
    }
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.restore();
  }

  const name = (student.name || "Student").toUpperCase();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = fitFont(ctx, name, TEXT_MAX);
  ctx.fillText(name, NAME_X, NAME_Y);

  if (student.yearOfJoin) {
    ctx.font = fitFont(ctx, student.yearOfJoin, TEXT_MAX);
    ctx.fillText(student.yearOfJoin, NAME_X, YEAR_Y);
  }
}

async function paintPoster(
  ctx: CanvasRenderingContext2D,
  student: OnlineBadgeStudent,
  theme: BadgeTheme,
) {
  await Promise.race([
    document.fonts.load("900 26px Inter"),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  const [template, photo] = await Promise.all([
    loadImage(asset(theme.template)),
    loadProfilePhoto(student.photoUrl),
  ]);
  drawPoster(ctx, student, template, photo);
}

export async function downloadOnlineAssessmentBadge(
  student: OnlineBadgeStudent,
  themeId: BadgeThemeId = "online",
): Promise<void> {
  const theme = BADGE_THEMES[themeId];
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = POSTER * scale;
  canvas.height = POSTER * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the IRP Clear Card");
  ctx.scale(scale, scale);
  await paintPoster(ctx, student, theme);
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `irp-clear-card-${theme.fileSlug}-${todayStamp()}.png`;
  link.click();
}

function PosterCanvas({ student, theme }: { student: OnlineBadgeStudent; theme: BadgeTheme }) {
  const [node, setNode] = useState<HTMLCanvasElement | null>(null);
  const { name, photoUrl, levelLabel, statusLabel, yearOfJoin } = student;

  useEffect(() => {
    if (!node) return;
    let cancel = false;
    node.width = POSTER;
    node.height = POSTER;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    void paintPoster(ctx, { name, photoUrl, levelLabel, statusLabel, yearOfJoin }, theme).then(() => {
      if (cancel) {
        return;
      }
    });
    return () => {
      cancel = true;
    };
  }, [node, name, photoUrl, levelLabel, statusLabel, yearOfJoin, theme]);

  return <canvas ref={setNode} className="h-auto w-full rounded-md" />;
}

export function ClearCardDialog({
  open,
  onOpenChange,
  student,
  themeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: OnlineBadgeStudent;
  themeId: BadgeThemeId;
}) {
  const theme = BADGE_THEMES[themeId];
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setError(null);
    setDownloading(true);
    try {
      await downloadOnlineAssessmentBadge(student, theme.id);
    } catch {
      setError("Could not download the IRP Clear Card. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[min(760px,calc(100vw-2rem))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{theme.dialogTitle}</DialogTitle>
          <DialogDescription>{theme.dialogBody}</DialogDescription>
        </DialogHeader>
        {open ? <PosterCanvas student={student} theme={theme} /> : null}
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={downloading}
          className="btn-pop inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading…" : "Download IRP Clear Card"}
        </button>
        {error ? <p className="text-xs font-medium text-[#b42318]">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

export function OnlineAssessmentBadgeActions({
  student,
  themeId = "online",
  label,
}: {
  student: OnlineBadgeStudent;
  themeId?: BadgeThemeId;
  label?: string;
}) {
  const theme = BADGE_THEMES[themeId];
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload() {
    setError(null);
    setDownloading(true);
    try {
      await downloadOnlineAssessmentBadge(student, theme.id);
    } catch {
      setError("Could not download the IRP Clear Card. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#eaecf0] pt-4">
        {label ? (
          <p className="w-full text-[11px] font-bold uppercase tracking-[0.14em] text-muted2">{label}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-pop inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
        >
          <IdCard className="h-4 w-4" />
          IRP Clear Card
        </button>
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-[#f9fafb] disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Downloading…" : "Download"}
        </button>
        {error ? <p className="w-full text-xs font-medium text-[#b42318]">{error}</p> : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[min(760px,calc(100vw-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{theme.dialogTitle}</DialogTitle>
            <DialogDescription>{theme.dialogBody}</DialogDescription>
          </DialogHeader>
          {open ? <PosterCanvas student={student} theme={theme} /> : null}
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={downloading}
            className="btn-pop inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Downloading…" : "Download"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
