import { Caveat, Dancing_Script, Great_Vibes, Sacramento } from "next/font/google";

/**
 * The faces a typed name can be signed in, and the pictures made from them.
 *
 * A typed signature is the name drawn in a handwriting face. It is drawn to a
 * PNG in the browser because that is what the PDF gets: an image stamped where
 * it was placed, looking exactly as it did on screen, with no font to embed in
 * somebody else's document and no chance of it rendering differently there.
 */

const dancing = Dancing_Script({ subsets: ["latin"], weight: ["600"], display: "swap" });
const vibes = Great_Vibes({ subsets: ["latin"], weight: ["400"], display: "swap" });
const sacramento = Sacramento({ subsets: ["latin"], weight: ["400"], display: "swap" });
const caveat = Caveat({ subsets: ["latin"], weight: ["600"], display: "swap" });

export type SignatureFace = {
  id: string;
  label: string;
  family: string;
  weight: number;
  /** Faces differ a lot in how big a given size looks. */
  scale: number;
};

export const SIGNATURE_FACES: SignatureFace[] = [
  { id: "flowing", label: "Flowing", family: vibes.style.fontFamily, weight: 400, scale: 1.15 },
  { id: "classic", label: "Classic", family: dancing.style.fontFamily, weight: 600, scale: 1 },
  { id: "slim", label: "Slim", family: sacramento.style.fontFamily, weight: 400, scale: 1.2 },
  { id: "print", label: "Print", family: caveat.style.fontFamily, weight: 600, scale: 1 },
];

export type Stamp = {
  /** For drawing on screen. */
  url: string;
  /** For sending — the same pixels. */
  blob: Blob;
  /** Width over height, which every placement of it keeps. */
  aspect: number;
};

const INK = "#1c2a4a";

async function draw(
  text: string,
  font: string,
  fontSize: number,
  color: string,
): Promise<Stamp | null> {
  if (typeof document === "undefined") return null;

  // A canvas does not wait for a web font: drawn before it arrives, the
  // signature would be stamped in the fallback face.
  try {
    await document.fonts.load(font, text);
  } catch {
    // Drawn in the fallback rather than not at all.
  }

  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return null;
  measure.font = font;
  const metrics = measure.measureText(text);

  // Handwriting faces swing well past their advance width and their nominal
  // ascent — the loop of a capital, the tail of a y — so the box is taken from
  // the glyphs' actual extent and padded, or the stamp is clipped.
  const ascent = Math.max(metrics.actualBoundingBoxAscent || 0, fontSize * 0.8);
  const descent = Math.max(metrics.actualBoundingBoxDescent || 0, fontSize * 0.25);
  const left = Math.max(metrics.actualBoundingBoxLeft || 0, 0);
  const right = Math.max(metrics.actualBoundingBoxRight || 0, metrics.width);
  const pad = Math.round(fontSize * 0.12);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(left + right + pad * 2);
  canvas.height = Math.ceil(ascent + descent + pad * 2);
  const gfx = canvas.getContext("2d");
  if (!gfx) return null;

  gfx.font = font;
  gfx.fillStyle = color;
  gfx.textBaseline = "alphabetic";
  gfx.fillText(text, pad + left, pad + ascent);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;

  return { url: URL.createObjectURL(blob), blob, aspect: canvas.width / canvas.height };
}

/** Big enough to stay crisp printed at the width of a signature line. */
const SIGNATURE_PX = 132;

export function drawSignature(name: string, face: SignatureFace) {
  const size = Math.round(SIGNATURE_PX * face.scale);
  return draw(name, `${face.weight} ${size}px ${face.family}`, size, INK);
}

export function drawDate(label: string) {
  return draw(
    label,
    `500 64px ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`,
    64,
    INK,
  );
}

/**
 * Today where the signer is, written out so it cannot be misread as month-first
 * or day-first. The signer's own day: it is the date they signed on.
 */
export function todayLabel() {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}
