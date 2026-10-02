import { getWorkspaceLogoUrl } from "@/base/lib/logo";

/**
 * The workspace's logo as a data URI, for a PDF.
 *
 * `workspaces.logo_url` holds a path in a private bucket rather than a URL, so
 * it has to be signed and then fetched before `@react-pdf` can draw it. This
 * was written inside the Work Plan export; the timeline export needs the same
 * mark, and two copies of this would be two chances to disagree about where a
 * logo lives.
 *
 * Returns null on anything it cannot honestly draw — no logo, a signature that
 * failed, a format `@react-pdf` does not render, or a file large enough to be
 * a problem — and every caller falls back to the monogram.
 */
export async function inlineLogo(stored: string | null): Promise<string | null> {
  if (!stored) return null;

  try {
    const url = await getWorkspaceLogoUrl(stored);
    if (!url) return null;

    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    // PNG and JPEG are what @react-pdf draws; an SVG here renders as nothing.
    if (!/^image\/(png|jpe?g)$/i.test(type)) return null;

    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 2_000_000) return null;

    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
