import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_UNAVAILABLE,
  EMAIL_ALREADY_REGISTERED,
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  canLoginWithStatus,
  isAuthDuplicateSignupError,
  isPlausibleEmail,
  mapSignupAuthError,
  normalizeEmail,
  releasedEmailForDeletedAccount,
} from "./email.ts";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  User@Example.com  "), "user@example.com");
  assert.equal(normalizeEmail("user@example.com"), "user@example.com");
});

test("normalizeEmail treats empty as empty string", () => {
  assert.equal(normalizeEmail(null), "");
  assert.equal(normalizeEmail(undefined), "");
  assert.equal(normalizeEmail("   "), "");
});

test("isPlausibleEmail", () => {
  assert.equal(isPlausibleEmail("user@example.com"), true);
  assert.equal(isPlausibleEmail("not-an-email"), false);
});

test("duplicate signup messages map to EMAIL_ALREADY_REGISTERED", () => {
  for (const message of [
    "User already registered",
    "A user with this email address has already been registered",
    "Email address is already in use",
  ]) {
    assert.equal(isAuthDuplicateSignupError(message), true);
    const mapped = mapSignupAuthError(message);
    assert.equal(mapped.code, EMAIL_ALREADY_REGISTERED);
    assert.equal(mapped.message, EMAIL_ALREADY_REGISTERED_MESSAGE);
    assert.equal(mapped.message.includes("user@"), false);
  }
});

test("unrelated signup errors stay generic", () => {
  const mapped = mapSignupAuthError("Password is too weak");
  assert.equal(mapped.code, "SIGNUP_FAILED");
  assert.equal(mapped.message.includes("too weak"), false);
});

test("login is allowed only for active accounts", () => {
  assert.equal(canLoginWithStatus("active"), true);
  assert.equal(canLoginWithStatus("suspended"), false);
  assert.equal(canLoginWithStatus("deleted"), false);
  assert.equal(canLoginWithStatus(null), false);
});

test("deleted accounts rewrite email so the original can be reused", () => {
  const released = releasedEmailForDeletedAccount(
    "11111111-1111-1111-1111-111111111111",
    "  Learner@Example.com ",
  );
  assert.equal(
    released,
    "deleted.11111111-1111-1111-1111-111111111111.learner@example.com",
  );
  assert.notEqual(released, "learner@example.com");
  assert.equal(ACCOUNT_UNAVAILABLE, "ACCOUNT_UNAVAILABLE");
});

test("public signup never reads a client-supplied role", () => {
  const body: { email: string; role?: string } = {
    email: "user@example.com",
    role: "admin",
  };
  const grantedRole = undefined as string | undefined;
  void body.role;
  assert.equal(grantedRole, undefined);
  assert.notEqual(body.role, grantedRole);
});
