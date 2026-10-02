const MARKER_PREFIX = "<!--pc-opp:";
const MARKER_SUFFIX = "-->";

export type OpportunityNotesPayload = {
  timing: string | null;
  context: string | null;
};

function normalizeTiming(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeContext(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Pack timing metadata into `notes` only when timing is non-empty.
 * Empty timing → context body alone (or null if context is also empty).
 * Never writes a human "Expected timing:" label.
 */
export function packOpportunityNotes(
  timing: string | null | undefined,
  context: string | null | undefined,
): string | null {
  const t = normalizeTiming(timing);
  const c = normalizeContext(context);

  if (!t) {
    return c;
  }

  const meta = JSON.stringify({ timing: t });
  const marker = `${MARKER_PREFIX}${meta}${MARKER_SUFFIX}`;
  return c ? `${marker}\n${c}` : marker;
}

/**
 * Unpack timing + context from `notes`.
 * Missing/bad marker → timing null, entire string as context.
 * Empty timing in JSON treated as null.
 */
export function unpackOpportunityNotes(
  notes: string | null | undefined,
): OpportunityNotesPayload {
  if (notes == null) {
    return { timing: null, context: null };
  }

  const raw = notes;
  if (!raw.trim()) {
    return { timing: null, context: null };
  }

  const firstNewline = raw.indexOf("\n");
  const firstLine = firstNewline === -1 ? raw : raw.slice(0, firstNewline);
  const rest = firstNewline === -1 ? "" : raw.slice(firstNewline + 1);

  if (
    firstLine.startsWith(MARKER_PREFIX) &&
    firstLine.endsWith(MARKER_SUFFIX)
  ) {
    const json = firstLine.slice(
      MARKER_PREFIX.length,
      firstLine.length - MARKER_SUFFIX.length,
    );
    try {
      const parsed = JSON.parse(json) as { timing?: unknown };
      const timing =
        typeof parsed.timing === "string"
          ? normalizeTiming(parsed.timing)
          : null;
      return {
        timing,
        context: normalizeContext(rest),
      };
    } catch {
      return { timing: null, context: normalizeContext(raw) };
    }
  }

  return { timing: null, context: normalizeContext(raw) };
}
