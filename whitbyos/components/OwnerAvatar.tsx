/**
 * The face beside a task — a photo where the person has one, their initials
 * where they do not.
 *
 * The photo is fetched through /api/avatar rather than from wherever it
 * actually lives. Uploaded ones are Supabase signed URLs and work anywhere;
 * ones that came in with a Google sign-in are googleusercontent links, and
 * those fail in a browser often enough to make an avatar unreliable. The proxy
 * makes every source behave the same, and answers a failure with a transparent
 * pixel — so the initials underneath show through instead of Chrome's
 * broken-image glyph.
 *
 * Sized by the caller because the reference does not use one size — 19px on a
 * Kanban card and in the Table, 20px in a task row and on the Timeline.
 *
 * The colourway is chosen from the person's id rather than their position in
 * whatever list they happen to be in, so the same face is the same colour on
 * the Kanban, in the task row and on the Timeline. Two people can still land
 * on the same colour; the initials are what tell them apart, and the colour is
 * only there so a row of faces reads as several people rather than one.
 */

const TONES = [
  { bg: "var(--avatar-tan-bg)", fg: "var(--avatar-tan-fg)" },
  { bg: "var(--avatar-blue-bg)", fg: "var(--avatar-blue-fg)" },
  { bg: "var(--avatar-green-bg)", fg: "var(--avatar-green-fg)" },
  { bg: "var(--avatar-orange-bg)", fg: "var(--avatar-orange-fg)" },
];

function toneFor(key: string | null) {
  if (!key) return TONES[0]!;
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) sum = (sum + key.charCodeAt(i)) % 1024;
  return TONES[sum % TONES.length]!;
}
export function OwnerAvatar({
  name,
  initials,
  userId,
  hasPhoto,
  size = 19,
  ring,
}: {
  name: string | null;
  initials: string | null;
  /** Whose photo to fetch. Null where nobody owns the thing. */
  userId: string | null;
  /** No request where there is no photo to get. */
  hasPhoto?: boolean;
  size?: number;
  /** The 1.5px surface ring the reference draws where avatars can overlap. */
  ring?: boolean;
}) {
  if (!initials) return null;

  const tone = toneFor(userId ?? initials);

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.42)),
        background: tone.bg,
        color: tone.fg,
        boxShadow: ring ? "0 0 0 1.5px var(--surface)" : undefined,
      }}
      title={name ?? undefined}
    >
      {initials}
      {userId && hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/avatar?id=${encodeURIComponent(userId)}`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
    </span>
  );
}
