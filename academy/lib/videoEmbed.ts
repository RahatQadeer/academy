export type VideoPlayback =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "file"; src: string };

export function parseVideoPlayback(url: string): VideoPlayback | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const youtube = trimmed.match(
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
  );
  if (youtube?.[1]) {
    return {
      kind: "youtube",
      src: `https://www.youtube-nocookie.com/embed/${youtube[1]}?rel=0&modestbranding=1`,
    };
  }

  const vimeo = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo?.[1]) {
    return { kind: "vimeo", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  }

  return { kind: "file", src: trimmed };
}
