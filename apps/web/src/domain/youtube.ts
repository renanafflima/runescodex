/**
 * Extracts the video id from a YouTube watch/short/embed URL and returns a
 * thumbnail image for it using YouTube's public, no-key-required thumbnail
 * endpoint. Returns null for anything that isn't a recognizable YouTube URL.
 */
export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const segment = parsed.pathname.slice(1).split("/")[0];
      return segment && segment.length > 0 ? segment : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      const embedMatch = parsed.pathname.match(/^\/(embed|shorts)\/([^/]+)/);
      if (embedMatch) return embedMatch[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function youtubeThumbnailUrl(url: string | null | undefined): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
