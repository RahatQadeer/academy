import test from "node:test";
import assert from "node:assert/strict";

import { inAppRecipients, isUnreadDuplicate, portalRecipients } from "./notify-recipients.ts";

const member = (contactId: string, over: Partial<{ portalAccess: boolean | null; reachesArea: boolean }> = {}) => ({
  contactId,
  portalAccess: null,
  reachesArea: true,
  ...over,
});

test("portal recipients are only people who are actually in the portal", () => {
  assert.deepEqual(portalRecipients([member("a"), member("b")], ["a"], []), ["a"]);
});

test("portal recipients skip access switched off, but not access never decided", () => {
  assert.deepEqual(
    portalRecipients([member("a", { portalAccess: false }), member("b", { portalAccess: null })], ["a", "b"], []),
    ["b"],
  );
});

test("portal recipients skip people not granted the area, and people who opted out", () => {
  assert.deepEqual(
    portalRecipients([member("a", { reachesArea: false }), member("b"), member("c")], ["a", "b", "c"], ["c"]),
    ["b"],
  );
});

test("an addressed portal notice reaches only the people it names", () => {
  assert.deepEqual(portalRecipients([member("a"), member("b")], ["a", "b"], [], ["b"]), ["b"]);
});

test("a second membership that reaches the area still counts", () => {
  assert.deepEqual(
    portalRecipients([member("a", { reachesArea: false }), member("a")], ["a"], []),
    ["a"],
  );
});

test("in-app recipients skip people who switched the event off", () => {
  assert.deepEqual(inAppRecipients(["a", "b", "c"], ["b"]), ["a", "c"]);
});

test("in-app recipients skip the actor when asked", () => {
  assert.deepEqual(inAppRecipients(["a", "b"], [], "a"), ["b"]);
});

test("in-app recipients de-duplicate membership rows", () => {
  assert.deepEqual(inAppRecipients(["a", "a", "b"], []), ["a", "b"]);
});

test("in-app recipients are empty when everyone opted out", () => {
  assert.deepEqual(inAppRecipients(["a", "b"], ["a", "b"]), []);
});

test("an unread notice for the same person, kind and entity is a duplicate", () => {
  assert.equal(
    isUnreadDuplicate(
      [{ recipientUserId: "a", kind: "form_submission", entityId: "s1" }],
      { recipientUserId: "a", kind: "form_submission", entityId: "s1" },
    ),
    true,
  );
  assert.equal(
    isUnreadDuplicate(
      [{ recipientUserId: "a", kind: "form_submission", entityId: "s1" }],
      { recipientUserId: "a", kind: "form_submission", entityId: "s2" },
    ),
    false,
  );
});
