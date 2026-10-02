import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answeredNeeds,
  clientNeeds,
  firmNeeds,
  needFieldId,
  needFieldType,
  needPlaceText,
  needSections,
  needSlug,
  needWhen,
  needsWithState,
  readNeedEdits,
  requirementState,
  saysWhoProvides,
} from "./plan-requirements.ts";
import type { PlanTask, PlanWorkstream, TaskRequirement } from "./work-plans.ts";

function task(id: string, requiredInputs: TaskRequirement[] = []): PlanTask {
  return {
    id,
    title: id,
    status: "not_started",
    kind: "manual",
    priority: null,
    due_date: null,
    completed_at: null,
    waiting_state: null,
    ownerInitials: null,
    ownerName: null,
    ownerUserId: null,
    ownerHasPhoto: false,
    checklist: [],
    blockedByStreamId: null,
    blockedByTaskId: null,
    description: null,
    rationale: null,
    startDate: null,
    estimatedDays: 1,
    expectedOutput: null,
    requiredInputs,
    externalLinks: [],
    providerId: null,
    providerNeed: null,
  };
}

function stream(id: string, tasks: PlanTask[]): PlanWorkstream {
  return {
    id,
    name: id,
    purpose: null,
    status: "not_started",
    kind: "manual",
    blocked: false,
    ownerName: null,
    ownerInitials: null,
    ownerUserId: null,
    ownerHasPhoto: false,
    tasks,
  };
}

/** A plan drafted since `from` exists: every requirement says who provides it. */
const MODERN = [
  stream("Immigration", [
    task("File the visa application", [
      { kind: "document", label: "Both adults' passports", from: "client" },
      { kind: "document", label: "Degree certificates", from: "client" },
      // The firm's own login. The client cannot give this and must never be
      // asked for it — the fault that made `from` necessary.
      { kind: "account", label: "Firm's IRCC portal account", from: "firm" },
    ]),
    task("Book the biometrics appointment", [
      // Same passports, named slightly differently by a different task.
      { kind: "document", label: "Both adults' passports.", from: "client" },
      { kind: "information", label: "Preferred appointment city", from: "client" },
      { kind: "document", label: "Police certificate", from: "third_party" },
    ]),
  ]),
  stream("Schooling", [
    task("Shortlist schools", [
      { kind: "approval", label: "Sign off on the shortlist", from: "client" },
      // Already in hand. Asking again is how a client learns to skim.
      { kind: "document", label: "Children's birth certificates", from: "client", alreadyHeld: true },
    ]),
  ]),
];

test("only what the client can actually provide is asked for", () => {
  const needs = clientNeeds(MODERN);

  assert.deepEqual(
    needs.map((need) => need.label),
    [
      "Both adults' passports",
      "Degree certificates",
      "Preferred appointment city",
      "Sign off on the shortlist",
    ],
  );
});

test("the firm's own account is never asked of the client", () => {
  const labels = clientNeeds(MODERN).map((need) => need.label);
  assert.ok(!labels.includes("Firm's IRCC portal account"));
});

test("what a third party has to issue is not asked of the client either", () => {
  const labels = clientNeeds(MODERN).map((need) => need.label);
  assert.ok(!labels.includes("Police certificate"));
});

test("something already on file is not asked for again", () => {
  const labels = clientNeeds(MODERN).map((need) => need.label);
  assert.ok(!labels.includes("Children's birth certificates"));
});

test("one need, however many tasks are waiting on it", () => {
  const passports = clientNeeds(MODERN).find((need) => need.slug === "both-adults-passports");

  assert.ok(passports);
  assert.deepEqual(passports.neededBy, [
    "File the visa application",
    "Book the biometrics appointment",
  ]);
});

test("labels that differ only in punctuation are the same need", () => {
  assert.equal(needSlug("Both adults' passports"), needSlug("Both adults' passports."));
  assert.equal(needSlug("  Degree Certificates  "), "degree-certificates");
});

test("a plan drafted before `from` falls back by kind rather than asking for everything", () => {
  const old = [
    stream("Immigration", [
      task("File the visa application", [
        { kind: "document", label: "Both adults' passports" },
        { kind: "information", label: "Existing IELTS scores" },
        { kind: "account", label: "Firm's IRCC portal account" },
        { kind: "contact", label: "The firm's usual translator" },
      ]),
    ]),
  ];

  assert.equal(saysWhoProvides(old), false);
  assert.deepEqual(
    clientNeeds(old).map((need) => need.label),
    ["Both adults' passports", "Existing IELTS scores"],
  );
});

test("a plan that says who provides is trusted over the fallback", () => {
  // A document explicitly marked as the firm's stays out, even though the
  // fallback would have included it on kind alone.
  const streams = [
    stream("Immigration", [
      task("File", [{ kind: "document", label: "Our own engagement letter", from: "firm" }]),
    ]),
  ];

  assert.equal(saysWhoProvides(streams), true);
  assert.deepEqual(clientNeeds(streams), []);
});

test("sections run in a fixed order and skip what is empty", () => {
  const sections = needSections(clientNeeds(MODERN));

  assert.deepEqual(
    sections.map((section) => section.kind),
    ["document", "information", "approval"],
  );
  assert.equal(sections[0].title, "Documents to upload");
  assert.equal(sections[0].needs.length, 2);
});

test("a document is asked for with a file input, a decision with yes or no", () => {
  assert.equal(needFieldType("document"), "file");
  assert.equal(needFieldType("approval"), "boolean");
  assert.equal(needFieldType("information"), "short");
  assert.equal(needFieldType("account"), "short");
  assert.equal(needFieldType("contact"), "short");
});

test("a need is answered when its own field has an answer, and not before", () => {
  const needs = clientNeeds(MODERN);
  const answered = answeredNeeds(needs, {
    [needFieldId("both-adults-passports")]: "acme/1700-passports.pdf",
    // Present but empty: a field the client opened and left alone.
    [needFieldId("degree-certificates")]: "   ",
    // An answer to a field this plan does not have.
    "need-something-else": "yes",
  });

  assert.deepEqual([...answered], ["both-adults-passports"]);
});

test("no responses at all means nothing is answered, not everything", () => {
  const needs = clientNeeds(MODERN);
  assert.equal(answeredNeeds(needs, null).size, 0);
  assert.equal(answeredNeeds(needs, undefined).size, 0);
  assert.equal(answeredNeeds(needs, {}).size, 0);
});

test("needsWithState reports the count, the answers and whether it guessed", () => {
  const state = needsWithState(MODERN, {
    [needFieldId("both-adults-passports")]: "acme/1700-passports.pdf",
  });

  assert.equal(state.total, 4);
  assert.equal(state.answered.size, 1);
  assert.equal(state.guessed, false);
  assert.equal(state.sections.length, 3);
});

test("a plan with nothing to ask for does not claim to have guessed", () => {
  const state = needsWithState([stream("Empty", [task("Nothing needed")])], null);

  assert.equal(state.total, 0);
  assert.equal(state.guessed, false);
  assert.deepEqual(state.sections, []);
});

test("a requirement with a blank label is dropped rather than asked for", () => {
  const streams = [
    stream("Immigration", [
      task("File", [
        { kind: "document", label: "   ", from: "client" },
        { kind: "document", label: "!!!", from: "client" },
      ]),
    ]),
  ];

  assert.deepEqual(clientNeeds(streams), []);
});

test("what is on file says so, whatever else is true", () => {
  const state = requirementState(
    { kind: "document", label: "Birth certificates", from: "client", alreadyHeld: true },
    { asked: false, answered: new Set(), guessing: false },
  );

  assert.deepEqual(state, { text: "on file", tone: "success" });
});

test("a need the client has answered says the client sent it", () => {
  const state = requirementState(
    { kind: "document", label: "Both adults' passports", from: "client" },
    { asked: true, answered: new Set(["both-adults-passports"]), guessing: false },
  );

  assert.deepEqual(state, { text: "sent by the client", tone: "success" });
});

test("a client need tells the truth about whether it has been asked for", () => {
  const passport: TaskRequirement = {
    kind: "document",
    label: "Both adults' passports",
    from: "client",
  };

  assert.equal(
    requirementState(passport, { asked: false, answered: new Set(), guessing: false })?.text,
    "not asked for yet",
  );
  assert.equal(
    requirementState(passport, { asked: true, answered: new Set(), guessing: false })?.text,
    "asked for, waiting",
  );
});

test("what is not the client's says whose it is instead", () => {
  const ctx = { asked: true, answered: new Set<string>(), guessing: false };

  assert.equal(
    requirementState({ kind: "account", label: "Our IRCC login", from: "firm" }, ctx)?.text,
    "ours to provide",
  );
  assert.equal(
    requirementState({ kind: "document", label: "Police certificate", from: "third_party" }, ctx)
      ?.text,
    "issued by a third party",
  );
});

test("nothing is said where nothing is known", () => {
  // The old "not held yet": alreadyHeld false, nothing else established. It is
  // the reason this function exists, and it must produce no words at all.
  assert.equal(
    requirementState({ kind: "account", label: "Some portal login", alreadyHeld: false }, null),
    null,
  );
  assert.equal(
    requirementState(
      { kind: "contact", label: "A translator" },
      { asked: true, answered: new Set(), guessing: true },
    ),
    null,
  );
});

test("with no ask to read, only the requirement's own facts are reported", () => {
  assert.equal(
    requirementState({ kind: "document", label: "Passports", from: "client" }, null)?.text,
    "not asked for yet",
  );
  assert.equal(
    requirementState({ kind: "document", label: "Passports", alreadyHeld: false }, null),
    null,
  );
});

test("a blank label is never given a state of its own", () => {
  assert.equal(
    requirementState({ kind: "document", label: "   ", from: "client" }, null),
    null,
  );
});

test("something the professional added is asked for alongside what was gathered", () => {
  const needs = clientNeeds(MODERN, {
    extra: [{ slug: "passport-photographs", label: "Six passport photographs", kind: "document" }],
  });

  const added = needs.find((need) => need.slug === "passport-photographs");
  assert.ok(added);
  assert.equal(added.added, true);
  assert.deepEqual(added.neededBy, []);
  // In the Documents section with the rest, not in a section of its own.
  assert.equal(needSections(needs)[0].needs.length, 3);
});

test("a skipped need leaves the ask without leaving its task", () => {
  const needs = clientNeeds(MODERN, { skip: ["degree-certificates"] });

  assert.ok(!needs.some((need) => need.slug === "degree-certificates"));
  // The rest are untouched.
  assert.equal(needs.length, 3);
});

test("an added need never overwrites a gathered one of the same name", () => {
  const needs = clientNeeds(MODERN, {
    extra: [
      { slug: "both-adults-passports", label: "Passports (mine)", kind: "information" },
    ],
  });

  const passports = needs.find((need) => need.slug === "both-adults-passports");
  assert.ok(passports);
  // Still the drafter's, still carrying the two tasks waiting on it.
  assert.equal(passports.label, "Both adults' passports");
  assert.equal(passports.kind, "document");
  assert.equal(passports.neededBy.length, 2);
});

test("skipping beats adding, so removing something added actually removes it", () => {
  const needs = clientNeeds(MODERN, {
    extra: [{ slug: "passport-photographs", label: "Six passport photographs", kind: "document" }],
    skip: ["passport-photographs"],
  });

  assert.ok(!needs.some((need) => need.slug === "passport-photographs"));
});

test("edits read off jsonb drop anything that is not the shape expected", () => {
  const edits = readNeedEdits(
    [
      { slug: "a", label: "A document", kind: "document" },
      { slug: "b", label: "A detail", kind: "information" },
      // An unknown kind falls back rather than reaching a form as a field type
      // nothing renders.
      { slug: "c", label: "Something", kind: "nonsense" },
      { slug: "d" },
      "not an object",
      null,
    ],
    ["x", "", 7, "y"],
  );

  assert.deepEqual(
    edits.extra?.map((one) => [one.slug, one.kind]),
    [
      ["a", "document"],
      ["b", "information"],
      ["c", "document"],
    ],
  );
  assert.deepEqual(edits.skip, ["x", "y"]);
});

test("edits read off a plan that has never been edited are empty, not undefined", () => {
  const edits = readNeedEdits([], []);
  assert.deepEqual(edits.extra, []);
  assert.deepEqual(edits.skip, []);

  const nothing = readNeedEdits(null, undefined);
  assert.deepEqual(nothing.extra, []);
  assert.deepEqual(nothing.skip, []);
});

test("a need taken off the ask by hand says nothing on its task", () => {
  const passport: TaskRequirement = {
    kind: "document",
    label: "Both adults' passports",
    from: "client",
  };
  const ctx = { asked: true, answered: new Set<string>(), guessing: false };

  assert.equal(requirementState(passport, ctx)?.text, "asked for, waiting");
  assert.equal(
    requirementState(passport, { ...ctx, skipped: new Set(["both-adults-passports"]) }),
    null,
  );
});

test("an answer already in beats a later removal", () => {
  // Removing the question does not unsend what the client sent.
  const state = requirementState(
    { kind: "document", label: "Both adults' passports", from: "client" },
    {
      asked: true,
      answered: new Set(["both-adults-passports"]),
      guessing: false,
      skipped: new Set(["both-adults-passports"]),
    },
  );

  assert.deepEqual(state, { text: "sent by the client", tone: "success" });
});

// ---- What, why, where and when

test("a need carries its reason, its place and the date it is holding up", () => {
  const passport: TaskRequirement = {
    kind: "document",
    label: "Passport copy",
    from: "client",
    why: "required for the visa application",
    where: "client_portal",
  };

  const first = { ...task("Submit visa application", [passport]), due_date: "2026-11-02" };
  const [need] = clientNeeds([stream("s", [first])]);

  assert.equal(need.label, "Passport copy");
  assert.equal(need.why, "required for the visa application");
  assert.equal(need.where, "client_portal");
  assert.equal(need.dueBy, "2026-11-02");
  assert.equal(
    needWhen(need, "Nov 2"),
    "Before we can start Submit visa application, due Nov 2",
  );
  // Written to the professional reading the plan, who has no portal account.
  assert.equal(
    needPlaceText(need.where),
    "Uploaded in the Portal, on the form we send",
  );
});

test("two tasks wanting the same thing keep the first reason and the earlier date", () => {
  const input = (why: string): TaskRequirement => ({
    kind: "document",
    label: "Passport copy",
    from: "client",
    why,
  });

  const [need] = clientNeeds([
    stream("s", [
      { ...task("Book the appointment", [input("the consulate books against it")]), due_date: "2026-12-01" },
      { ...task("Submit the application", [input("it goes in with the form")]), due_date: "2026-10-06" },
    ]),
  ]);

  assert.equal(need.why, "the consulate books against it");
  assert.equal(need.dueBy, "2026-10-06");
  assert.deepEqual(need.neededBy, ["Book the appointment", "Submit the application"]);
});

test("somewhere other than the portal outranks the portal", () => {
  const [need] = clientNeeds([
    stream("s", [
      task("Scan it", [{ kind: "document", label: "Birth certificate", from: "client" }]),
      task("Register the birth", [
        { kind: "document", label: "Birth certificate", from: "client", where: "by_post" },
      ]),
    ]),
  ]);

  assert.equal(need.where, "by_post");
  assert.match(needPlaceText(need.where), /original/);
});

test("a reason that only repeats the label is not a reason", () => {
  const [need] = clientNeeds([
    stream("s", [
      task("t", [
        { kind: "document", label: "Passport copy", from: "client", why: "Passport copy" },
      ]),
    ]),
  ]);

  assert.equal(need.why, null);
});

test("a plan drafted before any of this says nothing rather than guessing", () => {
  const [need] = clientNeeds([
    stream("s", [task("t", [{ kind: "document", label: "Passport copy", from: "client" }])]),
  ]);

  assert.equal(need.why, null);
  assert.equal(need.dueBy, null);
  // The portal is where the ask lands, so it is true rather than a guess.
  assert.equal(need.where, "client_portal");
  assert.equal(needWhen(need, null), "Before we can start t");
});

test("a hand-added need keeps the reason the professional typed", () => {
  const edits = readNeedEdits(
    [
      { slug: "six-photographs", label: "Six photographs", kind: "document", why: "the registrar wants them" },
      { slug: "old-passport", label: "Old passport", kind: "document" },
    ],
    [],
  );

  const needs = clientNeeds([stream("s", [])], edits);

  assert.equal(needs[0].why, "the registrar wants them");
  assert.equal(needs[1].why, null);
  // Nothing is waiting on a hand-added one, so there is no "when" to give.
  assert.equal(needWhen(needs[1], null), null);
});

/**
 * The professional's own half of the list.
 *
 * The brief pairs it with the client's and says both must stay short, so
 * every test here is about what does *not* earn a place: the way to keep a
 * derived list short is to be strict at the door, not to cut the end off.
 */
const own = (tasks: Parameters<typeof firmNeeds>[0][number]["tasks"]) => [{ tasks }];

const ownTask = (
  id: string,
  extra: Partial<Parameters<typeof firmNeeds>[0][number]["tasks"][number]> = {},
) => ({
  id,
  title: id,
  status: "not_started",
  kind: "manual" as const,
  requiredInputs: [],
  ...extra,
});

test("an approval is on the list because an approval is a person saying yes", () => {
  const out = firmNeeds(own([ownTask("Sign the engagement letter", { kind: "approval" })]));

  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "decide");
  assert.equal(out[0].label, "Sign the engagement letter");
});

test("ordinary work is not, however much of it there is", () => {
  const out = firmNeeds(
    own([ownTask("a"), ownTask("b"), ownTask("c", { kind: "auto" })]),
  );

  assert.deepEqual(out, []);
});

test("what the firm has to produce is on it; what the client provides is not", () => {
  const out = firmNeeds(
    own([
      ownTask("Prepare the forms", {
        requiredInputs: [
          { kind: "document", label: "Our signed authority", from: "firm" },
          { kind: "document", label: "Their passport", from: "client" },
          { kind: "document", label: "Police certificate", from: "third_party" },
        ],
      }),
    ]),
  );

  assert.deepEqual(
    out.map((row) => row.label),
    ["Our signed authority"],
  );
  assert.equal(out[0].kind, "provide");
});

test("what the firm already holds is not chased", () => {
  const out = firmNeeds(
    own([
      ownTask("Prepare the forms", {
        requiredInputs: [
          { kind: "document", label: "Our template", from: "firm", alreadyHeld: true },
        ],
      }),
    ]),
  );

  assert.deepEqual(out, []);
});

test("a finished task takes its approvals and its homework with it", () => {
  const out = firmNeeds(
    own([
      ownTask("Done with it", {
        status: "complete",
        kind: "approval",
        requiredInputs: [{ kind: "document", label: "Our authority", from: "firm" }],
      }),
    ]),
  );

  assert.deepEqual(out, []);
});

test("the same thing wanted by two tasks is one row", () => {
  const input = { kind: "document" as const, label: "Our signed authority", from: "firm" as const };
  const out = firmNeeds(
    own([
      ownTask("one", { requiredInputs: [input] }),
      ownTask("two", { requiredInputs: [{ ...input, label: "our  Signed Authority" }] }),
    ]),
  );

  assert.equal(out.length, 1);
});

test("what is due soonest comes first, and what has no date comes last", () => {
  const out = firmNeeds(
    own([
      ownTask("later", { kind: "approval", due_date: "2027-03-20" }),
      ownTask("undated", { kind: "approval" }),
      ownTask("sooner", { kind: "approval", due_date: "2027-01-05" }),
    ]),
  );

  assert.deepEqual(
    out.map((row) => row.label),
    ["sooner", "later", "undated"],
  );
});
