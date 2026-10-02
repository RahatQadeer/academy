import assert from "node:assert/strict";
import test from "node:test";
import {
  AREA_KEYS,
  ALL_AREAS,
  areaSummary,
  areasFromForm,
  grantedAreas,
  readAreas,
} from "./access.ts";

/**
 * `readAreas` decides what every screen, nav item and write action in the portal
 * will allow. Both directions of a mistake here are silent: granting too much
 * shows one member of a household another's affairs, and granting too little
 * locks somebody out of an account they have been using for months. Neither
 * announces itself, which is why this is the file with the tests.
 */

const EVERY_AREA_TICKED = {
  requests: true,
  messages: true,
  calendar: true,
  documents: true,
  forms: true,
  updates: true,
  billing: true,
  integrations: true,
  people: true,
};

test("a primary member holds every area, whatever the column says", () => {
  // 2.1.2.1 is never shown for the account holder, so their row is empty and
  // always will be. Reading that as "no access" locks them out of their own
  // portal.
  assert.deepEqual(readAreas({}, "primary_member").areas, ALL_AREAS);
  assert.deepEqual(readAreas(null, "primary_member").areas, ALL_AREAS);

  // Even an explicit denial does not apply to them.
  const denied = readAreas({ requests: false, billing: false }, "primary_member");
  assert.deepEqual(denied.areas, ALL_AREAS);
  assert.equal(denied.viewOnly, false);
});

test("nothing recorded inherits full access, and says so", () => {
  // The regression this guards against: every membership created before
  // whitbyos/025 has an empty object and has been working with full access
  // since the day it was made. Reading "not decided" as "denied" would revoke
  // access from all of them the moment this shipped.
  for (const raw of [{}, null, undefined, [], "not an object", 42]) {
    const access = readAreas(raw, "additional_member");
    assert.deepEqual(access.areas, ALL_AREAS, `for ${JSON.stringify(raw) ?? "undefined"}`);
    assert.equal(access.inherited, true);
  }
});

test("a permissions object with only view_only still inherits the areas", () => {
  // `view_only` is not an area key. On its own it says how somebody may act,
  // not what they may reach, so the areas are still undecided.
  const access = readAreas({ view_only: true }, "additional_member");
  assert.deepEqual(access.areas, ALL_AREAS);
  assert.equal(access.inherited, true);
  assert.equal(access.viewOnly, true);
});

test("ticks are honoured exactly once any area key is present", () => {
  const access = readAreas(
    { view_only: false, requests: true, messages: true, documents: true, billing: false },
    "authorized_user",
  );

  assert.equal(access.inherited, false);
  assert.equal(access.viewOnly, false);
  assert.equal(access.areas.requests, true);
  assert.equal(access.areas.messages, true);
  assert.equal(access.areas.documents, true);
  assert.equal(access.areas.billing, false);
});

test("the three areas 2.1.2.1 cannot tick follow Requests", () => {
  // Calendar, Forms and Updates have no checkbox on the professional's approval
  // screen, so they are never written. Defaulting them on would let a
  // Billing-only contact read the whole progress feed.
  const billingOnly = readAreas(
    { requests: false, messages: false, documents: false, billing: true },
    "additional_member",
  );
  assert.equal(billingOnly.areas.billing, true);
  assert.equal(billingOnly.areas.calendar, false);
  assert.equal(billingOnly.areas.forms, false);
  assert.equal(billingOnly.areas.updates, false);

  // And defaulting them off would hide a form from somebody told to fill it in.
  const withRequests = readAreas(
    { requests: true, messages: false, documents: false, billing: false },
    "additional_member",
  );
  assert.equal(withRequests.areas.calendar, true);
  assert.equal(withRequests.areas.forms, true);
  assert.equal(withRequests.areas.updates, true);
});

test("a written key always beats the derived one", () => {
  // When the professional's screen grows the three checkboxes, they arrive as
  // real keys and the derivation must stop being consulted.
  const access = readAreas(
    { requests: true, forms: false, calendar: false, updates: true },
    "additional_member",
  );
  assert.equal(access.areas.forms, false);
  assert.equal(access.areas.calendar, false);
  assert.equal(access.areas.updates, true);
});

test("only true grants an area", () => {
  // The column is jsonb, so anything can land in it. Only an actual `true`
  // counts, because a truthy string is not a decision anybody made.
  const access = readAreas(
    { requests: "yes", messages: 1, documents: null, billing: true },
    "additional_member",
  );
  assert.equal(access.areas.requests, false);
  assert.equal(access.areas.messages, false);
  assert.equal(access.areas.documents, false);
  assert.equal(access.areas.billing, true);
});

test("view only is read off the object, not the role", () => {
  assert.equal(readAreas({ view_only: true, requests: true }, "additional_member").viewOnly, true);
  assert.equal(readAreas({ view_only: false, requests: true }, "additional_member").viewOnly, false);
  // Anything that is not exactly `true` is not view only.
  assert.equal(readAreas({ view_only: "yes", requests: true }, "additional_member").viewOnly, false);
});

test("a dependent with everything denied reaches nothing", () => {
  const access = readAreas(
    {
      view_only: true,
      requests: false,
      messages: false,
      documents: false,
      billing: false,
    },
    "dependent",
  );
  assert.deepEqual(grantedAreas(access.areas), []);
  assert.equal(areaSummary(access.areas), "No areas");
});

test("readAreas always answers about all nine areas", () => {
  // A missing key would read as `undefined`, and `!areas[area]` would let it
  // through as denied by luck rather than by rule. Every gate in the portal
  // indexes this object, so it has to be total.
  const access = readAreas({ requests: true }, "additional_member");
  for (const key of AREA_KEYS) {
    assert.equal(typeof access.areas[key], "boolean", key);
  }
});

test("areaSummary names the granted areas, and stays quiet at full access", () => {
  assert.equal(areaSummary(EVERY_AREA_TICKED), null);
  assert.equal(
    areaSummary({
      ...EVERY_AREA_TICKED,
      billing: false,
      updates: false,
      integrations: false,
      people: false,
    }),
    "Requests, Messages, Calendar, Documents and Forms",
  );
  assert.equal(
    areaSummary(readAreas({ requests: false, messages: false, documents: false, billing: true }, "additional_member").areas),
    "Billing",
  );
});

test("areaSummary reads in nav order, not the order the keys arrived", () => {
  const access = readAreas(
    { billing: true, requests: true, messages: false, documents: false },
    "additional_member",
  );
  assert.equal(areaSummary(access.areas), "Requests, Calendar, Forms, Updates and Billing");
});

test("Integrations and People & Access are granted, never assumed", () => {
  // The bug this file exists to stop coming back: both screens used to sit
  // outside the permission system entirely, so a member granted Requests alone
  // still had the Integrations page and the list of everyone on the account.
  // Neither follows another area, so an approval that does not name them
  // denies them.
  const requestsOnly = readAreas(
    { requests: true, messages: false, documents: false, billing: false },
    "additional_member",
  );
  assert.equal(requestsOnly.areas.integrations, false);
  assert.equal(requestsOnly.areas.people, false);

  // Including an approval written before 2.1.2.1 grew the two checkboxes:
  // whatever else it ticked, it never ticked these.
  const fullOldGrant = readAreas(
    { view_only: false, requests: true, messages: true, documents: true, billing: true },
    "authorized_user",
  );
  assert.equal(fullOldGrant.areas.integrations, false);
  assert.equal(fullOldGrant.areas.people, false);

  // And they are ordinary areas once ticked.
  const granted = readAreas(
    { requests: false, integrations: true, people: true },
    "additional_member",
  );
  assert.equal(granted.areas.integrations, true);
  assert.equal(granted.areas.people, true);
  assert.equal(granted.areas.requests, false);
});

test("the account holder and an undecided membership still hold both", () => {
  // Narrowing is for people the professional ticked boxes for. The primary
  // member holds the account, and a membership with nothing recorded has been
  // working with full access since it was made — neither loses a screen
  // because two new keys appeared.
  assert.equal(readAreas({}, "primary_member").areas.integrations, true);
  assert.equal(readAreas({}, "primary_member").areas.people, true);

  const inherited = readAreas({ view_only: true }, "additional_member");
  assert.equal(inherited.inherited, true);
  assert.equal(inherited.areas.integrations, true);
  assert.equal(inherited.areas.people, true);
});

test("areasFromForm keeps only areas the module recognises", () => {
  assert.deepEqual(areasFromForm(["billing", "requests"]), ["requests", "billing"]);
  assert.deepEqual(areasFromForm(["people", "integrations"]), [
    "integrations",
    "people",
  ]);
  // A hand-edited form cannot write a key the professional's screen will never
  // render — an area nobody can see is an area nobody can revoke.
  assert.deepEqual(areasFromForm(["admin", "view_only", "__proto__"]), []);
  assert.deepEqual(areasFromForm([]), []);
});
