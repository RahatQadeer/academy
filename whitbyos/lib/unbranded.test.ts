import assert from "node:assert/strict";
import { test } from "node:test";
import { unbranded } from "./unbranded.ts";

/**
 * What a Playbook may say, once it has left the firm's own screens.
 *
 * SRS §1.4 — a client is shown the firm, never the software. These are the
 * shapes the drafter actually writes, because those are the ones that were
 * carrying the name into Playbooks and from there into clients' plans.
 */

test("the product as the thing doing the work becomes the firm", () => {
  assert.equal(
    unbranded("Whitby will confirm the appointment before the deadline."),
    "We will confirm the appointment before the deadline.",
  );
  // And the verb agrees with the firm it now belongs to.
  assert.equal(unbranded("Whitby drafts the covering letter."), "We draft the covering letter.");
  assert.equal(unbranded("Whitby watches the deadline."), "We watch the deadline.");
});

test("being asked to do something", () => {
  assert.equal(
    unbranded("Ask Whitby to redo it, or fill them in by hand."),
    "Ask us to redo it, or fill them in by hand.",
  );
});

test("possessive and place", () => {
  assert.equal(unbranded("Whitby's own check"), "our own check");
  assert.equal(unbranded("Held in Whitby"), "Held in the workspace");
});

test("a bare mention mid-sentence still goes", () => {
  assert.equal(
    unbranded("Everything above was prepared with Whitby and reviewed here."),
    "Everything above was prepared with the workspace and reviewed here.",
  );
});

test("text with nothing to take out is returned as it was", () => {
  const text = "Collect visa documentation and confirm the appointment.";
  assert.equal(unbranded(text), text);
});

test("nothing in, nothing out", () => {
  assert.equal(unbranded(null), null);
  assert.equal(unbranded(undefined), null);
  assert.equal(unbranded(""), "");
});
