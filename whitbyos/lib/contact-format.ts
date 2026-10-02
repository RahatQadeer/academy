/**
 * What an email, a phone number and a website have to look like to be kept.
 *
 * Deliberately loose. The job is to catch what is plainly not the thing —
 * "ahmedpartners" in the email box, a sentence in the website box, letters in
 * a phone number — and not to adjudicate the rest. A validator stricter than
 * reality refuses real addresses, and a refused field is filled in wrong
 * somewhere else instead, or not at all.
 *
 * Phone numbers especially: every country writes them differently, so the only
 * rule is that it is mostly digits and enough of them to be a number.
 */

/** Something@something.tld, with no spaces. Nothing cleverer than that. */
export function isEmail(value: string) {
  const text = value.trim();
  if (!text) return true;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(text);
}

/**
 * Digits, and the punctuation people put between them.
 *
 * Seven is the shortest real number anywhere; the ceiling is well past the
 * longest so that an extension on the end is not refused.
 */
export function isPhone(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (!/^[+()\-.\s\d]+$/.test(text)) return false;
  const digits = text.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 18;
}

/**
 * A host, with or without a scheme.
 *
 * People type "ahmedpartners.co.uk", and the autofill that started all this
 * put a whole sentence in the box. A dot with something either side of it, and
 * no spaces, separates the two.
 */
export function isWebsite(value: string) {
  const text = value.trim();
  if (!text) return true;
  const withoutScheme = text.replace(/^https?:\/\//i, "");
  if (!withoutScheme || /\s/.test(withoutScheme)) return false;
  const host = withoutScheme.split(/[/?#]/)[0] ?? "";
  return /^[^\s.]+(\.[^\s.]+)+$/.test(host);
}

/** The first thing that is wrong, in the words the screen should say. */
export function contactProblem(input: {
  email?: string | null;
  phone?: string | null;
  website?: string | null;
}): string | null {
  if (input.email && !isEmail(input.email)) {
    return "That email address does not look right. It needs an @ and a domain.";
  }
  if (input.phone && !isPhone(input.phone)) {
    return "That phone number does not look right. Digits, spaces and + only.";
  }
  if (input.website && !isWebsite(input.website)) {
    return "That website does not look right. Something like ahmedpartners.co.uk.";
  }
  return null;
}
