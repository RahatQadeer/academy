/**
 * What the portal checks about a new password, and what it says when Supabase
 * refuses one.
 *
 * Its own module, and not in `lib/actions/`, because that folder is
 * `"use server"` and may only export async functions. Being a plain module also
 * means these rules can be tested, which for the one form in the product that
 * can lock somebody out of their own account is worth having.
 */

export const MIN_PASSWORD_LENGTH = 8;

/**
 * The checks that can be made without asking the server.
 *
 * Returns the sentence to show, or null when there is nothing wrong. Deliberately
 * not a boolean: every one of these has a different answer, and "invalid
 * password" would make the client guess which.
 *
 * Whether the new password is the same as the current one is *not* checked here,
 * and cannot be: nothing on this side knows the current one. Supabase does, and
 * refuses it — see `passwordRefusal`.
 */
export function passwordProblem(
  password: string | null,
  confirm: string | null,
): string | null {
  if (!password) return "Enter a new password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password !== confirm) return "Those passwords do not match.";
  return null;
}

/**
 * Supabase's refusals, in words a client can act on.
 *
 * Matched on the error *code* rather than the message. The codes are a stable
 * contract (`ErrorCode` in @supabase/auth-js); the messages are English prose
 * from the auth server that changes between releases, and two of these are
 * cases the client can fix themselves — so they are worth saying properly
 * rather than passing through.
 *
 * `same_password` is the one this form exists to enforce. It is the auth
 * server's check because it is the only party that holds the current password's
 * hash, and it is a real refusal rather than a no-op: without it, "Update
 * password" on an unchanged password would report success and change nothing.
 *
 * Anything unrecognised falls through to Supabase's own message, which is
 * better than a generic sentence for the failures nobody predicted.
 */
export function passwordRefusal(
  code: string | undefined,
  message: string,
): string {
  switch (code) {
    case "same_password":
      return "That is the password you already have. Choose a different one.";
    case "weak_password":
      return "That password is too easy to guess. Try a longer one, or add a number or symbol.";
    // The project can require a fresh sign-in before a password change. The
    // client has done nothing wrong and the fix is theirs to make.
    case "reauthentication_needed":
      return "For your security, sign out and sign in again before changing your password.";
    case "over_request_rate_limit":
      return "Too many attempts just now. Wait a minute and try again.";
    default:
      return message;
  }
}
