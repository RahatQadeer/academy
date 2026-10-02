import assert from "node:assert/strict";
import test from "node:test";
import {
  FORM_STATUS,
  formActionLabel,
  formIsEditable,
  formNeedsClient,
  matchesRequestTab,
  toClientRequestStatus,
} from "./status.ts";
import type { FormStatus } from "../types/index.ts";

const ALL_FORM_STATUSES: FormStatus[] = [
  "awaiting",
  "draft",
  "submitted",
  "needs_review",
  "accepted",
  "correction_required",
];

/**
 * The correction loop turns on these three predicates, and each one is a
 * different question about the same status: may the client type into it, is it
 * waiting on them, and what does the button say. They disagreed once — a form
 * sent back for correction read as "Submitted" — and the client was never told
 * their team had asked for anything.
 */

test("correction_required is editable, and is the point of the state", () => {
  // A read-only correction request is a note the client can see and cannot act
  // on, which is the bug this state exists to prevent.
  assert.equal(formIsEditable("correction_required"), true);
  assert.equal(formNeedsClient("correction_required"), true);
  assert.equal(formActionLabel("correction_required"), "Correct & Resubmit");
});

test("a form with the team is closed to the client", () => {
  // These three are what `persist` refuses to write to. If any of them became
  // editable, a stale tab could overwrite answers the professional has already
  // signed off and reset their review in the same statement.
  for (const status of ["submitted", "needs_review", "accepted"] as const) {
    assert.equal(formIsEditable(status), false, status);
    assert.equal(formNeedsClient(status), false, status);
    assert.equal(formActionLabel(status), "View", status);
  }
});

test("the two states waiting on the client are the two Action Needed shows", () => {
  const waiting = ALL_FORM_STATUSES.filter(formNeedsClient);
  assert.deepEqual(waiting.sort(), ["awaiting", "correction_required"]);
});

test("everything the client can act on, they can also edit", () => {
  // Needing an answer and being able to give one have to agree. A status that
  // is `formNeedsClient` and not `formIsEditable` would put a form on Action
  // Needed with no way to complete it.
  for (const status of ALL_FORM_STATUSES) {
    if (formNeedsClient(status)) {
      assert.equal(formIsEditable(status), true, status);
    }
  }
});

test("a draft is editable without being an outstanding ask", () => {
  // The client started it themselves, so nobody is waiting on them for it.
  assert.equal(formIsEditable("draft"), true);
  assert.equal(formNeedsClient("draft"), false);
  assert.equal(formActionLabel("draft"), "Continue");
});

test("all six statuses have a label and a tone", () => {
  // `FORM_STATUS[form.status]` is indexed directly in three screens, so a
  // missing entry renders as a crash rather than a fallback.
  for (const status of ALL_FORM_STATUSES) {
    assert.equal(typeof FORM_STATUS[status].label, "string", status);
    assert.ok(FORM_STATUS[status].label.length > 0, status);
    assert.ok(FORM_STATUS[status].tone, status);
  }
});

test("the two states waiting on the client are the two that are not neutral", () => {
  assert.equal(FORM_STATUS.awaiting.tone, "warning");
  assert.equal(FORM_STATUS.correction_required.tone, "danger");
});

test("accepted and submitted are told apart", () => {
  // They used to collapse into one word, so a form the professional had signed
  // off looked exactly like one still sitting in their queue.
  assert.notEqual(FORM_STATUS.accepted.label, FORM_STATUS.submitted.label);
});

test("a closed request reads as completed whatever the status column says", () => {
  assert.equal(toClientRequestStatus("running", "2026-01-02T00:00:00Z"), "completed");
  assert.equal(toClientRequestStatus(null, "2026-01-02T00:00:00Z"), "completed");
});

test("an unrecognised request status reads as Running, not as an internal name", () => {
  assert.equal(toClientRequestStatus("triage_pending", null), "running");
  assert.equal(toClientRequestStatus(null, null), "running");
});

test("every status WhitbyOS can write is named, not left to the default", () => {
  // The professional's own four, from whitbyos/lib/request-status.ts, plus
  // `open` which is the older spelling of not_started and still in rows.
  //
  // waiting_on_client is the one that has to be right: it means the work has
  // stopped and the client is why. Falling through to Running told them it was
  // in hand, and filed it under Active instead of Waiting.
  assert.equal(toClientRequestStatus("waiting_on_client", null), "waiting");
  assert.equal(toClientRequestStatus("not_started", null), "running");
  assert.equal(toClientRequestStatus("open", null), "running");
  assert.equal(toClientRequestStatus("running", null), "running");
  assert.equal(toClientRequestStatus("completed", null), "completed");
});

test("a request waiting on the client is in Waiting, not Active", () => {
  const status = toClientRequestStatus("waiting_on_client", null);
  assert.equal(matchesRequestTab(status, "waiting"), true);
  assert.equal(matchesRequestTab(status, "active"), false);
});

test("request tabs partition the statuses without overlap", () => {
  // Every request belongs to exactly one of Active, Waiting and Completed, and
  // "all" holds all of them. A status in two tabs would be counted twice.
  const statuses = ["running", "approval", "waiting", "completed", "draft"] as const;
  for (const status of statuses) {
    const tabs = (["active", "waiting", "completed"] as const).filter((tab) =>
      matchesRequestTab(status, tab),
    );
    assert.ok(tabs.length <= 1, `${status} is in ${tabs.join(", ")}`);
    assert.equal(matchesRequestTab(status, "all"), true, status);
  }
});

/**
 * The required-field rule `persist` applies, on its own.
 *
 * It is a one-liner in the action, and it decides whether a submit is accepted
 * — which is also the moment that used to upload a file and then throw the
 * answers away. Extracted here so the rule can be exercised without a database
 * or a request: the action does the two passes, this checks the rule the second
 * pass depends on.
 */
function missingRequired(
  fields: { key: string; label: string; required?: boolean }[],
  responses: Record<string, string>,
): string[] {
  return fields
    .filter((field) => field.required && !responses[field.key])
    .map((field) => field.label);
}

test("a required field with no answer blocks the submit", () => {
  const fields = [
    { key: "appraisal", label: "Most recent appraisal date", required: true },
    { key: "items", label: "Items over $50,000" },
  ];
  assert.deepEqual(missingRequired(fields, { items: "x" }), [
    "Most recent appraisal date",
  ]);
  assert.deepEqual(missingRequired(fields, { appraisal: "2025-04-11" }), []);
});

test("an empty string is not an answer", () => {
  // `persist` only writes a trimmed, non-empty value into `responses`, so a
  // field answered with spaces never reaches the map. This is the rule that
  // makes that matter.
  const fields = [{ key: "a", label: "A", required: true }];
  assert.deepEqual(missingRequired(fields, { a: "" }), ["A"]);
  assert.deepEqual(missingRequired(fields, {}), ["A"]);
  assert.deepEqual(missingRequired(fields, { a: "answered" }), []);
});

test("a chosen file counts as answered before it is uploaded", () => {
  // The placeholder `persist` puts in `responses` for a file that is queued but
  // not yet uploaded. It has to satisfy the required check, or the two passes
  // would reject a form whose only missing answer is one the client did supply
  // — which is the whole reason the upload was moved after this check.
  const PENDING = "\u0000pending-upload";
  const fields = [{ key: "passport", label: "Passport", required: true }];
  assert.deepEqual(missingRequired(fields, { passport: PENDING }), []);
});

test("every required field is named, not just the first", () => {
  const fields = [
    { key: "a", label: "First", required: true },
    { key: "b", label: "Second", required: true },
    { key: "c", label: "Third" },
  ];
  assert.deepEqual(missingRequired(fields, {}), ["First", "Second"]);
});
