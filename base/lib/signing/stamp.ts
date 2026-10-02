import "server-only";

import { PDFDocument, degrees, type PDFImage } from "pdf-lib";
import { parsePlacements, toPdfRect, type Placement, type PlacementKind } from "./placement";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

export function looksLikePdf(bytes: Uint8Array) {
  // `%PDF`, allowing for the few bytes of junk some generators put first.
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return head.includes("%PDF-");
}

export function looksLikePng(bytes: Uint8Array) {
  return PNG_MAGIC.every((byte, index) => bytes[index] === byte);
}

export async function pdfPageCount(bytes: Uint8Array): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    const count = pdf.getPageCount();
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}

/**
 * Put the signature where it was placed and hand back the new file.
 *
 * The browser sends pictures of the signature and the date, and where they go;
 * the PDF itself is read here, from Storage, never from the browser. So what
 * gets filed is the document the firm sent with marks added to it, and not
 * whatever file the client's machine chose to send back.
 *
 * Each picture is embedded once and drawn as many times as it was placed.
 */
export async function stampPdf(
  original: Uint8Array,
  placements: Placement[],
  images: Partial<Record<PlacementKind, Uint8Array>>,
): Promise<{ bytes: Uint8Array } | { error: string }> {
  try {
    return { bytes: await stamp(original, placements, images) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      error: /encrypt/i.test(message)
        ? "This PDF is password-protected, so a signature cannot be added to it here. Use “Sign on paper” instead."
        : "This PDF could not be read. Use “Sign on paper” instead.",
    };
  }
}

// A damaged file can get past `load` and fail at any later step, so all of it
// sits inside the one catch above.
async function stamp(
  original: Uint8Array,
  placements: Placement[],
  images: Partial<Record<PlacementKind, Uint8Array>>,
) {
  const pdf = await PDFDocument.load(original, { updateMetadata: false });

  const embedded = new Map<PlacementKind, PDFImage>();
  for (const kind of new Set(placements.map((placement) => placement.kind))) {
    const png = images[kind];
    if (!png) throw new Error("missing stamp");
    embedded.set(kind, await pdf.embedPng(png));
  }

  const pages = pdf.getPages();
  for (const placement of placements) {
    const page = pages[placement.page];
    const image = embedded.get(placement.kind);
    if (!page || !image) continue;

    const crop = page.getCropBox();
    const rect = toPdfRect(placement, {
      left: crop.x,
      bottom: crop.y,
      width: crop.width,
      height: crop.height,
      rotation: page.getRotation().angle,
    });

    page.drawImage(image, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      rotate: degrees(rect.rotate),
    });
  }

  pdf.setModificationDate(new Date());
  return pdf.save();
}

/** A picture of a signature is a few kilobytes; anything near this is not one. */
const MAX_STAMP_BYTES = 2 * 1024 * 1024;

/**
 * Everything the signing screen sends, checked and stamped into `original`.
 *
 * Both products sign through this, so a signature is refused for the same
 * reasons whichever side placed it. The caller has already decided the signer
 * may sign this document and fetched the PDF itself; this decides only whether
 * what arrived is a signature that can go on it.
 */
export async function signFromForm(
  formData: FormData,
  original: Uint8Array,
): Promise<{ bytes: Uint8Array; name: string } | { error: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Type your name to make your signature." };
  if (name.length > 80) return { error: "That name is longer than a signature can hold." };

  if (!looksLikePdf(original)) {
    return { error: "This file is not a PDF. Use “Sign on paper” instead." };
  }

  const images: Partial<Record<PlacementKind, Uint8Array>> = {};
  for (const kind of ["signature", "date"] as const) {
    const picture = formData.get(kind);
    if (!(picture instanceof File) || picture.size === 0) continue;
    if (picture.size > MAX_STAMP_BYTES) return { error: "The signature image was too large." };
    const bytes = new Uint8Array(await picture.arrayBuffer());
    if (!looksLikePng(bytes)) return { error: "The signature did not come through. Please try again." };
    images[kind] = bytes;
  }

  const pageCount = await pdfPageCount(original);
  if (!pageCount) return { error: "This PDF could not be read. Use “Sign on paper” instead." };

  const placements = parsePlacements(formData.get("placements"), pageCount);
  if (!placements || !placements.some((placement) => placement.kind === "signature")) {
    return { error: "Place your signature on the document first." };
  }
  if (placements.some((placement) => !images[placement.kind])) {
    return { error: "The signature did not come through. Please try again." };
  }

  const stamped = await stampPdf(original, placements, images);
  if ("error" in stamped) return stamped;
  return { bytes: stamped.bytes, name };
}

/** `Lease.pdf` → `Lease-signed.pdf`, safe for a Storage path. */
export function signedFileName(title: string, extension: string) {
  const base =
    title.replace(/[^\w.\-]+/g, "_").replace(/\.[a-z0-9]+$/i, "").slice(0, 60) || "document";
  return `${base}-signed.${extension}`;
}
