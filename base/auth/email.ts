/**
 * Checking an email address before an invitation is built around it.
 *
 * The point is not to be clever about what is deliverable — nothing short of
 * sending can know that. It is to catch the mistakes that otherwise become an
 * invitation sitting pending forever against an address that was never real,
 * with the professional waiting on a reply.
 *
 * So: shape, then the handful of typos that account for most of them.
 */

/**
 * Deliberately stricter than the RFC, which permits quoted local parts,
 * comments and addresses with no dot in the domain. None of those turn up in a
 * client's email, and allowing them would let "jordan@localhost" through.
 */
const SHAPE = /^[^\s@,;]+@[^\s@.,;]+(\.[^\s@.,;]+)+$/;

/** Domains that are almost always a slip of the finger for a real one. */
const TYPOS: Record<string, string> = {
  "gmail.co": "gmail.com",
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "iclould.com": "icloud.com",
  "icloud.co": "icloud.com",
};

export type EmailCheck =
  /** Usable. `suggestion` is set when it also looks like a near-miss. */
  | { ok: true; email: string; suggestion?: string }
  | { ok: false; reason: string };

/**
 * A malformed address is refused; a suspicious one is not.
 *
 * The difference matters: "jordan@gmail" cannot be right, but "gmail.co" is a
 * real domain in Colombia, and refusing it would leave somebody unable to
 * invite a client whose address is simply unusual. So a typo comes back as a
 * suggestion the professional is shown and can act on, and the address is
 * never quietly corrected for them.
 */
export function checkEmail(raw: string): EmailCheck {
  const email = raw.trim();

  if (!email) return { ok: false, reason: "An email address is needed." };

  if (email.includes(" ")) {
    return { ok: false, reason: "That address has a space in it, check for a stray character." };
  }

  if (/[,;]/.test(email)) {
    return {
      ok: false,
      reason: "Enter one address. Several people are invited one at a time, each with their own.",
    };
  }

  if (!email.includes("@")) {
    return { ok: false, reason: "That does not look like an email address, it has no @." };
  }

  if (!SHAPE.test(email)) {
    return {
      ok: false,
      reason: `"${email}" does not look like an email address. Check the part after the @.`,
    };
  }

  const domain = email.split("@")[1]!.toLowerCase();

  // A single-letter top level domain is always a slip; there are none.
  if (domain.split(".").pop()!.length < 2) {
    return { ok: false, reason: `"${domain}" is missing the end of its domain.` };
  }

  const corrected = TYPOS[domain];
  return corrected
    ? { ok: true, email, suggestion: `${email.split("@")[0]}@${corrected}` }
    : { ok: true, email };
}
