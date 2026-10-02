import { cn } from "@/base/lib/cn";

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PA";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
}

export function Avatar({
  name,
  size = 28,
  tone = "tan",
  className,
  src,
}: {
  name: string;
  size?: number;
  tone?: "tan" | "blue";
  className?: string;
  /** The person's own photo. Initials are the fallback, not the default. */
  src?: string | null;
}) {
  const bg = tone === "tan" ? "var(--avatar-tan-bg)" : "var(--avatar-blue-bg)";
  const fg = tone === "tan" ? "var(--avatar-tan-fg)" : "var(--avatar-blue-fg)";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold uppercase",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: Math.max(10, Math.round(size * 0.36)),
      }}
      aria-hidden
    >
      {src ? (
        // A signed URL on a private bucket, which the image optimiser cannot
        // fetch, so this stays a plain img.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover"
          // A Google account photo is served from lh3.googleusercontent.com,
          // which refuses the request when a referrer is sent.
          referrerPolicy="no-referrer"
        />
      ) : (
        initialsFrom(name)
      )}
    </span>
  );
}
