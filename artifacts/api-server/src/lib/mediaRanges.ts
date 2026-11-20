/** Keep every response well below production proxy response-size limits. */
export const MEDIA_CHUNK_BYTES = 2 * 1024 * 1024;
const LOOM_SOURCE = "https://drive.usercontent.google.com/download?id=12CnEaVZ9m2Fwr13DRj_AdNyDnek4lrA4&export=download";

export function boundedMediaRange(range?: string): string | null {
  if (!range) return `bytes=0-${MEDIA_CHUNK_BYTES - 1}`;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffix = Number(match[2]);
    return Number.isSafeInteger(suffix) && suffix > 0
      ? `bytes=-${Math.min(suffix, MEDIA_CHUNK_BYTES)}` : null;
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : start + MEDIA_CHUNK_BYTES - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null;
  return `bytes=${start}-${Math.min(requestedEnd, start + MEDIA_CHUNK_BYTES - 1)}`;
}

export async function fetchLoomRange(range: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const upstream = await fetcher(LOOM_SOURCE, {
    headers: { Range: range, "Accept-Encoding": "identity" },
    redirect: "follow",
    signal,
  });
  if (upstream.status === 416) return { status: 416 as const, contentRange: upstream.headers.get("content-range") };
  const contentRange = upstream.headers.get("content-range");
  const parsed = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange ?? "");
  const type = upstream.headers.get("content-type") ?? "";
  const length = parsed ? Number(parsed[2]) - Number(parsed[1]) + 1 : 0;
  if (upstream.status !== 206 || !parsed || !type.startsWith("video/") ||
      length <= 0 || length > MEDIA_CHUNK_BYTES || Number(parsed[2]) >= Number(parsed[3])) {
    await upstream.body?.cancel();
    throw new Error(`Drive did not return a bounded video range (HTTP ${upstream.status})`);
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  if (body.length !== length) throw new Error("Drive returned an incomplete video chunk");
  return { status: 206 as const, contentRange: contentRange!, total: Number(parsed[3]), type, body };
}
