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

const BADGE_X = 584;
const BADGE_Y = 356;
const BADGE_W = 389;
const PHOTO_W = 317;
const PHOTO_H = 282;
const PHOTO_X = BADGE_X + (BADGE_W - PHOTO_W) / 2;
const PHOTO_Y = BADGE_Y + 108;

const BAR_X = 76;
const BAR_W = 332;
const BAR_H = 78;
const BAR_1_Y = 418;
const BAR_2_Y = 514;

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
  title: [string, string];
  dialogTitle: string;
  dialogBody: string;
  fileSlug: string;
  badgeTop: string;
  badgeBottom: string;
  photoWell: string;
  lanyard: string;
};

const BADGE_THEMES: Record<BadgeThemeId, BadgeTheme> = {
  online: {
    id: "online",
    title: ["IRP Online", "Assessment"],
    dialogTitle: "Online Assessment IRP Clear Card",
    dialogBody: "You qualified in the IRP online assessment. Download this IRP Clear Card to save or share it.",
    fileSlug: "online",
    badgeTop: "#0420d8",
    badgeBottom: "#04045c",
    photoWell: "rgba(8, 24, 120, 0.55)",
    lanyard: "irp-lanyard.svg?v=3",
  },
  fe: {
    id: "fe",
    title: ["FE", "Project"],
    dialogTitle: "FE Project IRP Clear Card",
    dialogBody: "You cleared the FE Project. Download this IRP Clear Card to save or share it.",
    fileSlug: "fe",
    badgeTop: "#14c214",
    badgeBottom: "#067006",
    photoWell: "rgba(6, 110, 6, 0.55)",
    lanyard: "irp-lanyard-fe.svg",
  },
  panel: {
    id: "panel",
    title: ["Panel", "Interview"],
    dialogTitle: "Panel Interview IRP Clear Card",
    dialogBody: "You cleared the panel interview. Download this IRP Clear Card to save or share it.",
    fileSlug: "panel",
    badgeTop: "#12c8d4",
    badgeBottom: "#063848",
    photoWell: "rgba(6, 70, 82, 0.55)",
    lanyard: "irp-lanyard-panel.svg",
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

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadProfilePhoto(): Promise<HTMLImageElement | null> {
  try {
    const token = getAuthToken();
    const response = await fetch("/api/student/profile-photo", {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return null;
    let blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const type =
        bytes[0] === 0xff && bytes[1] === 0xd8
          ? "image/jpeg"
          : bytes[0] === 0x89 && bytes[1] === 0x50
            ? "image/png"
            : "image/jpeg";
      blob = new Blob([bytes], { type });
    }
    const url = URL.createObjectURL(blob);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    return img;
  } catch {
    return null;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

function drawEmptyPhoto(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(PHOTO_X + 46, PHOTO_Y + 40);
  ctx.lineTo(PHOTO_X + PHOTO_W - 46, PHOTO_Y + PHOTO_H - 40);
  ctx.moveTo(PHOTO_X + PHOTO_W - 46, PHOTO_Y + 40);
  ctx.lineTo(PHOTO_X + 46, PHOTO_Y + PHOTO_H - 40);
  ctx.stroke();
}

function drawPoster(
  ctx: CanvasRenderingContext2D,
  student: OnlineBadgeStudent,
  theme: BadgeTheme,
  logo: HTMLImageElement | null,
  wave: HTMLImageElement | null,
  lanyard: HTMLImageElement | null,
  photo: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, POSTER, POSTER);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, POSTER, POSTER);

  ctx.save();
  ctx.strokeStyle = "rgba(180, 186, 196, 0.45)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= POSTER; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, POSTER);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(POSTER, i);
    ctx.stroke();
  }
  ctx.restore();

  if (wave) ctx.drawImage(wave, 0, POSTER - wave.height, wave.width, wave.height);
  if (logo) ctx.drawImage(logo, 74, 62, 210, 104);

  ctx.fillStyle = "#16181d";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "800 68px Inter, sans-serif";
  ctx.fillText(theme.title[0], BAR_X, 228);
  ctx.fillText(theme.title[1], BAR_X, 300);

  const drawBar = (y: number, label: string) => {
    ctx.fillStyle = "#0014b1";
    roundRect(ctx, BAR_X, y, BAR_W, BAR_H, 3);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 30px Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(label, BAR_X + 22, y + BAR_H / 2 + 1);
  };
  drawBar(BAR_1_Y, student.levelLabel || "L1 Hustler");
  drawBar(BAR_2_Y, student.statusLabel || "Cleared");

  const name = (student.name || "Student").toUpperCase();
  ctx.font = "900 26px Inter, sans-serif";
  const nameLines = wrapLines(ctx, name, PHOTO_W);
  const year = student.yearOfJoin;
  const textTop = PHOTO_Y + PHOTO_H + 22;
  const nameBlock = 16 + 8 + nameLines.length * 30;
  const yearBlock = year ? 18 + 16 + 8 + 30 : 0;
  const badgeH = textTop - BADGE_Y + nameBlock + yearBlock + 28;

  ctx.save();
  ctx.shadowColor = "rgba(8, 20, 80, 0.28)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 16;
  const badgeGradient = ctx.createLinearGradient(0, BADGE_Y, 0, BADGE_Y + badgeH);
  badgeGradient.addColorStop(0, theme.badgeTop);
  badgeGradient.addColorStop(1, theme.badgeBottom);
  roundRect(ctx, BADGE_X, BADGE_Y, BADGE_W, badgeH, 30);
  ctx.fillStyle = badgeGradient;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 8);
  ctx.clip();
  ctx.fillStyle = theme.photoWell;
  ctx.fillRect(PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H);
  if (photo) {
    const ir = photo.width / photo.height;
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
      dy = PHOTO_Y;
    }
    ctx.drawImage(photo, dx, dy, dw, dh);
  } else {
    drawEmptyPhoto(ctx);
  }
  ctx.restore();
  ctx.save();
  roundRect(ctx, PHOTO_X, PHOTO_Y, PHOTO_W, PHOTO_H, 8);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  let y = textTop;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "700 13px Inter, sans-serif";
  ctx.fillText("NAME", PHOTO_X, y);
  y += 20;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 26px Inter, sans-serif";
  for (const line of nameLines) {
    ctx.fillText(line, PHOTO_X, y);
    y += 30;
  }
  if (year) {
    y += 12;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PHOTO_X, y);
    ctx.lineTo(PHOTO_X + PHOTO_W, y);
    ctx.stroke();
    y += 16;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 13px Inter, sans-serif";
    ctx.fillText("YEAR OF JOIN", PHOTO_X, y);
    y += 20;
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 22px Inter, sans-serif";
    const yearLines = wrapLines(ctx, year, PHOTO_W);
    for (const line of yearLines) {
      ctx.fillText(line, PHOTO_X, y);
      y += 28;
    }
  }

  if (lanyard) {
    const lw = 210;
    const lh = 430;
    ctx.drawImage(lanyard, BADGE_X + BADGE_W / 2 - lw / 2, 56, lw, lh);
  }
}

async function paintPoster(
  ctx: CanvasRenderingContext2D,
  student: OnlineBadgeStudent,
  theme: BadgeTheme,
) {
  await Promise.race([
    document.fonts.load("800 68px Inter"),
    document.fonts.load("900 26px Inter"),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
  const [logo, wave, lanyard, photo] = await Promise.all([
    loadImage(asset("nxtwave-academy-logo.png")),
    loadImage(asset("irp-wave.png")),
    loadImage(asset(theme.lanyard)),
    loadProfilePhoto(),
  ]);
  drawPoster(ctx, student, theme, logo, wave, lanyard, photo);
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
