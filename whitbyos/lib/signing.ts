/**
 * Signing, as the two sides see it — SRS §14.12 without the integration.
 *
 * One document, one question: which side has been asked to sign, and what did
 * they answer. Both products read these same four columns (migration 072) and
 * both draw from this file, so the professional and the client can never be
 * looking at the same document and reading two different states off it.
 *
 * No dates are computed here and no rows are written. This is the vocabulary.
 */

export type SignatureSide = "client" | "professional";
export type SignatureState = "awaiting" | "signed" | "declined";

export type DocumentSignature = {
  /** Who has been asked. Null when nobody has. */
  requiredFrom: SignatureSide | null;
  state: SignatureState | null;
  /** What the signer typed when they signed or declined. */
  note: string | null;
  at: string | null;
};

export function readSignature(row: {
  signature_required_from?: string | null;
  signature_state?: string | null;
  signature_note?: string | null;
  signature_actioned_at?: string | null;
}): DocumentSignature {
  const side = row.signature_required_from;
  const state = row.signature_state;

  return {
    requiredFrom: side === "client" || side === "professional" ? side : null,
    state:
      state === "awaiting" || state === "signed" || state === "declined" ? state : null,
    note: row.signature_note?.trim() || null,
    at: row.signature_actioned_at ?? null,
  };
}

/** Whether this side is the one currently being asked to act. */
export function isWaitingOn(signature: DocumentSignature, side: SignatureSide) {
  return signature.state === "awaiting" && signature.requiredFrom === side;
}

/**
 * What the document's signing line says, written for the side reading it.
 *
 * The same row reads differently from each end — "Waiting on you" and "Sent
 * for signature" are the same fact — so the viewer is an argument rather than
 * something each screen works out for itself and gets subtly wrong.
 */
export function signatureLine(
  signature: DocumentSignature,
  viewer: SignatureSide,
): { label: string; tone: "warning" | "success" | "danger" | "neutral" } | null {
  if (!signature.state || !signature.requiredFrom) return null;

  if (signature.state === "signed") {
    return { label: "Signed", tone: "success" };
  }

  if (signature.state === "declined") {
    return { label: "Declined", tone: "danger" };
  }

  return signature.requiredFrom === viewer
    ? { label: "Waiting on you", tone: "warning" }
    : { label: "Sent for signature", tone: "neutral" };
}

/** The other end of the round trip. */
export function otherSide(side: SignatureSide): SignatureSide {
  return side === "client" ? "professional" : "client";
}
