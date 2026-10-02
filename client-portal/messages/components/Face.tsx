import { initialsFrom } from "@/base/components/Avatar";

/** The four avatar colourways Whitby's Messages cycles through. */
const FACE_TONES = [
  { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" },
  { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" },
  { background: "var(--avatar-green-bg)", color: "var(--avatar-green-fg)" },
  { background: "var(--avatar-orange-bg)", color: "var(--avatar-orange-fg)" },
];

/**
 * One round face — the same mark `whitbyos/messages/page.tsx` draws, so the two
 * sides of a conversation look like one product.
 *
 * The colourway comes from the name rather than the row's position, so a person
 * keeps the same one everywhere and does not change colour as the list reorders.
 */
export function Face({
  name,
  photo,
  size = 34,
}: {
  name: string;
  /** Their own, where they have added one. Initials are the fallback. */
  photo?: string | null;
  size?: number;
}) {
  const tone =
    FACE_TONES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % FACE_TONES.length];

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{ ...tone, height: size, width: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {photo ? (
        // A signed URL on a private bucket, which `next/image` cannot fetch; a
        // Google account photo is refused outright when a referrer is sent.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initialsFrom(name)
      )}
    </span>
  );
}
