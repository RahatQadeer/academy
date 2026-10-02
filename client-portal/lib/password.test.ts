import assert from "node:assert/strict";
import test from "node:test";
import { MIN_PASSWORD_LENGTH, passwordProblem, passwordRefusal } from "./password.ts";

test("a password and its confirmation that agree are accepted", () => {
  assert.equal(passwordProblem("a-new-password", "a-new-password"), null);
});

test("an empty password is asked for rather than measured", () => {
  assert.equal(passwordProblem(null, null), "Enter a new password.");
  assert.equal(passwordProblem("", ""), "Enter a new password.");
});

test("a short password says how short is long enough", () => {
  assert.equal(
    passwordProblem("short", "short"),
    `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  );
});

test("exactly the minimum is long enough", () => {
  assert.equal(passwordProblem("12345678", "12345678"), null);
});

test("a mismatch is reported as a mismatch, not as a length", () => {
  assert.equal(
    passwordProblem("a-new-password", "a-new-passward"),
    "Those passwords do not match.",
  );
});

test("length is checked before the match, so a short pair says so once", () => {
  assert.equal(
    passwordProblem("short", "different"),
    `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  );
});

/**
 * Whitespace is part of a password and never trimmed.
 *
 * `text()` in lib/actions/guard.ts trims every field it reads, which is right
 * for a name and wrong for this: a password set as "  hunter2  " would be
 * stored as "hunter2" and then refused at sign-in, where nothing trims.
 */
test("a password that is only spaces is still a password of that length", () => {
  assert.equal(passwordProblem("        ", "        "), null);
});

test("leading and trailing spaces count, and must match on both sides", () => {
  assert.equal(passwordProblem(" longenough ", "longenough"), "Those passwords do not match.");
});

test("reusing the current password is refused in words that say what to do", () => {
  assert.equal(
    passwordRefusal("same_password", "New password should be different from the old password."),
    "That is the password you already have. Choose a different one.",
  );
});

test("a weak password is told how to be stronger", () => {
  assert.match(passwordRefusal("weak_password", "Password is too weak"), /longer one/);
});

test("needing a fresh sign-in says so rather than reading as a fault", () => {
  assert.match(
    passwordRefusal("reauthentication_needed", "Reauthentication required"),
    /sign out and sign in again/i,
  );
});

test("an unrecognised refusal keeps Supabase's own words", () => {
  assert.equal(
    passwordRefusal("some_future_code", "Something specific went wrong."),
    "Something specific went wrong.",
  );
  assert.equal(passwordRefusal(undefined, "No code at all."), "No code at all.");
});
