/**
 * Where a signature was put, and where that is in the PDF.
 *
 * The signing screen draws each page at whatever size fits the window, so a
 * placement is recorded as fractions of the page as it was *seen*: 0,0 is the
 * top-left corner of the rendered page, 1,1 the bottom-right. That survives the
 * window being resized and is independent of the scale pdf.js drew at.
 *
 * The PDF has its own idea of the page: points, origin at the bottom-left, and
 * possibly a `/Rotate` that turns what is stored into what is shown. Scanned
 * landscape pages are the usual case. `toPdfRect` undoes both, so a signature
 * dropped on the bottom right of a page that looks upright lands on the bottom
 * right of that page and reads upright once stamped.
 *
 * No I/O here — the server action and the tests both use it.
 */

export type PlacementKind = "signature" | "date";

export type Placement = {
  /** Zero-based page index. */
  page: number;
  kind: PlacementKind;
  /** Fractions of the rendered page, top-left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Enough for a signature and a date on every page of a long agreement. */
export const MAX_PLACEMENTS = 60;

/**
 * Read what the browser sent. Anything malformed is refused whole rather than
 * half-stamped: a signature missing from one page is worse than being asked to
 * place it again.
 */
export function parsePlacements(raw: unknown, pageCount: number): Placement[] | null {
  if (typeof raw !== "string" || raw.length > 20_000) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PLACEMENTS) return null;

  const placements: Placement[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const { page, kind, x, y, w, h } = item as Record<string, unknown>;

    if (kind !== "signature" && kind !== "date") return null;
    if (!Number.isInteger(page) || (page as number) < 0 || (page as number) >= pageCount) return null;

    const box = [x, y, w, h];
    if (!box.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    const [fx, fy, fw, fh] = box as number[];

    // A little slack past the edge, for a drag that ended on the border.
    if (fx < -0.001 || fy < -0.001 || fw <= 0.005 || fh <= 0.002) return null;
    if (fx + fw > 1.001 || fy + fh > 1.001) return null;

    placements.push({ page: page as number, kind, x: fx, y: fy, w: fw, h: fh });
  }

  return placements;
}

export type PageBox = {
  /** The visible box (CropBox) in PDF points. */
  left: number;
  bottom: number;
  width: number;
  height: number;
  /** `/Rotate`, clockwise, one of 0, 90, 180, 270. */
  rotation: number;
};

export type PdfRect = {
  /** Where the image's own bottom-left corner goes, in PDF user space. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Counter-clockwise, which is how pdf-lib's `rotate` turns an image. */
  rotate: number;
};

export function normaliseRotation(angle: number) {
  const turned = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return turned;
}

/**
 * A point on the page as seen (fractions, top-left origin) to PDF user space.
 *
 * The four cases are the four ways a stored page can be turned to be shown.
 * Rotation is clockwise for display, so at 90° the stored page's bottom-left
 * corner is what appears top-left, and moving right on screen moves up the
 * stored page.
 */
function seenToUser(u: number, v: number, box: PageBox): [number, number] {
  const { left, bottom, width: W, height: H } = box;
  switch (normaliseRotation(box.rotation)) {
    case 90:
      return [left + v * W, bottom + u * H];
    case 180:
      return [left + (1 - u) * W, bottom + v * H];
    case 270:
      return [left + (1 - v) * W, bottom + (1 - u) * H];
    default:
      return [left + u * W, bottom + (1 - v) * H];
  }
}

export function toPdfRect(placement: Placement, box: PageBox): PdfRect {
  const rotation = normaliseRotation(box.rotation);
  const sideways = rotation === 90 || rotation === 270;
  const seenWidth = sideways ? box.height : box.width;
  const seenHeight = sideways ? box.width : box.height;

  // The image is anchored at its bottom-left as the reader sees it, then turned
  // by the page's own rotation so the page's turn brings it back upright.
  const [x, y] = seenToUser(placement.x, placement.y + placement.h, box);

  return {
    x,
    y,
    width: placement.w * seenWidth,
    height: placement.h * seenHeight,
    rotate: rotation,
  };
}

/** Only a Storage path to a PDF can be signed on screen. */
export function isSignablePdf(fileUrl: string | null | undefined) {
  const value = (fileUrl ?? "").trim();
  if (!value || /^[a-z]+:/i.test(value)) return false;
  return /\.pdf$/i.test(value.split("?")[0]);
}
