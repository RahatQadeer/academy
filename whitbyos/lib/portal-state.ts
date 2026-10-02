/**
 * Whether a client's person is actually in the portal, and what to do if not.
 *
 * The Clients list had a Status column that read Active on every row, because
 * `whitbyos_clients.status` is a default nobody sets — 13 of 13 rows said
 * "active" and the column carried no information at all. What a professional
 * wants to know from that list is whether the client can actually get in, and
 * that is a fact the product does record.
 *
 * Six states, not two. "Invited" and "never sent" both look like waiting from
 * the outside and need opposite things done about them.
 */
export type PortalState =
  | "none"
  | "not_sent"
  | "invited"
  | "link_expired"
  | "expired"
  | "active"
  | "deleted";

/**
 * How long the link inside the invitation email stays usable.
 *
 * Two clocks run on one invitation and they are nothing like each other. The
 * row lives for `INVITE_DAYS` — a fortnight — and `/invite/<token>` honours
 * exactly that. But the address in the email is not that URL: it is Supabase's
 * own `/auth/v1/verify`, which redirects to it, and that leg dies after
 * `mailer_otp_exp` seconds. On this project that is 3600.
 *
 * So between one hour and fourteen days the invitation is alive and the email
 * announcing it is not. The professional saw "Pending" and waited; the client
 * clicked and got an error. This is the gap being named.
 *
 * Read from the environment rather than written here, because the number
 * belongs to the Supabase project and not to this file — raise it there and
 * this follows. `SUPABASE_EMAIL_LINK_TTL_SECONDS` is documented in
 * `.env.example`; the default is Supabase's own.
 */
const DEFAULT_EMAIL_LINK_TTL_SECONDS = 3600;

export function emailLinkTtlSeconds(): number {
  const raw = Number(process.env.SUPABASE_EMAIL_LINK_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_EMAIL_LINK_TTL_SECONDS;
}

/** Whether the link that was emailed has outlived its hour. */
export function emailLinkLapsed(sentAt: string | null | undefined): boolean {
  if (!sentAt) return false;
  const sent = new Date(sentAt).getTime();
  if (Number.isNaN(sent)) return false;
  return Date.now() - sent > emailLinkTtlSeconds() * 1000;
}

export function portalStateOf(input: {
  /** They had an account and closed it. */
  closed?: boolean;
  /** An auth identity exists for this contact, however they got there. */
  inThePortal?: boolean;
  invitation?: {
    status?: string | null;
    expiresAt?: string | null;
    delivered?: boolean | null;
    /** When the email went, which is when its link started its hour. */
    sentAt?: string | null;
  } | null;
}): PortalState {
  if (input.closed) return "deleted";
  if (input.inThePortal) return "active";

  const invitation = input.invitation;
  if (invitation?.status === "pending") {
    const lapsed = invitation.expiresAt ? new Date(invitation.expiresAt) < new Date() : false;
    // `email_delivered` is null on rows written before it existed. Those were
    // sent under the old code, which reported delivery honestly at the time, so
    // they read as invited rather than being retroactively doubted.
    if (lapsed) return "expired";
    if (invitation.delivered === false) return "not_sent";
    // Nothing is lost here — the invitation is still good and its own link
    // still opens. What has gone is the way in that the person was actually
    // given, so the row has to ask for a resend rather than claim to be
    // waiting on them.
    if (emailLinkLapsed(invitation.sentAt)) return "link_expired";
    return "invited";
  }
  if (invitation?.status === "expired" || invitation?.status === "revoked") return "expired";

  return "none";
}

/** What the pill says, and what it means. */
export const PORTAL_STATE: Record<
  PortalState,
  { label: string; tone: "success" | "warning" | "danger" | "neutral"; note: string }
> = {
  active: { label: "Active", tone: "success", note: "They have signed in to the portal" },
  invited: { label: "Pending", tone: "warning", note: "Invitation sent, not accepted yet" },
  link_expired: {
    label: "Link expired",
    tone: "danger",
    note: "The emailed link lapsed after an hour. Send it again, or pass on the invitation's own link",
  },
  not_sent: { label: "Not sent", tone: "danger", note: "The invitation email never went out" },
  expired: { label: "Expired", tone: "danger", note: "The invitation lapsed before it was used" },
  none: { label: "No portal", tone: "neutral", note: "Nobody has been invited yet" },
  deleted: { label: "Closed", tone: "neutral", note: "They closed their portal account" },
};

export function portalLabel(state: PortalState) {
  return PORTAL_STATE[state].label;
}

export function portalTone(state: PortalState) {
  return PORTAL_STATE[state].tone;
}

/**
 * What the date beside the badge is a date *of*.
 *
 * A bare "2h ago" under a Pending badge and a bare "2h ago" under an Active one
 * are two different facts, and the column cannot be read without being told
 * which. One word each.
 */
export function portalWhen(state: PortalState) {
  switch (state) {
    case "active":
      return "Joined";
    case "invited":
    case "not_sent":
    case "link_expired":
      return "Invited";
    case "expired":
      return "Expired";
    case "deleted":
      return "Closed";
    default:
      return "Added";
  }
}

/** Sending again is only worth offering where it would change something. */
export function canResend(state: PortalState) {
  return (
    state === "invited" ||
    state === "not_sent" ||
    state === "link_expired" ||
    state === "expired" ||
    state === "none"
  );
}
