import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * The same bug happened three times, and each time it was found by somebody
 * looking at a screen and saying "why is this empty".
 *
 *   1. The steps arrived with no durations and no dependencies, so every task
 *      was dated on the deadline.
 *   2. Nothing said which outside firm a task needed.
 *   3. An event plan needing an AV supplier, a photographer and a chauffeur
 *      recorded none of them.
 *
 * One cause each time: a field the product reads was optional in the schema.
 * Under a JSON-schema response, a model fills what is required and skips what
 * is not, and on a long answer the optional field is the first thing dropped
 * to fit. It is not a model that misbehaves; it is a schema that did not ask.
 *
 * So this asks instead, at build time. Anything below is read by
 * `saveDraftedPlan` on its way into the database, and making one of them
 * optional again fails here rather than in a plan somebody is relying on.
 *
 * Where a field is legitimately empty some of the time, the answer is a value
 * the model can write — "" for no predecessor, [] for nothing needed, an empty
 * category for a step that needs nobody outside — never absence.
 */

const SOURCE = new URL("./draft-workplan.ts", import.meta.url);

/** The schema as the file actually declares it, comments stripped. */
function schema(): Record<string, unknown> {
  const text = readFileSync(SOURCE, "utf8");
  const start = text.indexOf("const SCHEMA = {");
  assert.notEqual(start, -1, "draft-workplan.ts no longer declares SCHEMA");

  const body = text
    .slice(start + "const SCHEMA = ".length, text.indexOf("\n};", start) + 2)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  return new Function(`return (${body})`)() as Record<string, unknown>;
}

function at(path: string[]): Record<string, unknown> {
  let node = schema();
  for (const key of path) node = (node as Record<string, Record<string, unknown>>)[key]!;
  return node;
}

const STEP = ["properties", "workStreams", "items", "properties", "steps", "items"];

test("every step field the product reads is required of the model", () => {
  const required = at(STEP).required as string[];

  for (const field of [
    "name",
    "kind",
    "dueOffsetDays",
    "description",
    "rationale",
    // Without these two the scheduler has nothing to schedule: no durations
    // and no edges is N independent one-day tasks, all due on the deadline.
    "estimatedDays",
    "dependsOn",
    "expectedOutput",
    "steps",
    "assigneeRole",
    "requiredInputs",
    "resources",
    "providerNeeded",
  ]) {
    assert.ok(required.includes(field), `"${field}" must be required of the model`);
  }
});

test("a step's own steps carry who does each one", () => {
  const step = at([...STEP, "properties", "steps", "items"]);
  assert.deepEqual(step.required, ["text", "role"]);
});

test("a resource says whether its details were checked", () => {
  const resource = at([...STEP, "properties", "resources", "items"]);
  assert.ok((resource.required as string[]).includes("verified"));
});

test("the plan's own risks and considerations are required", () => {
  const required = schema().required as string[];
  assert.ok(required.includes("risks"));
  assert.ok(required.includes("considerations"));
});

test("fields that are legitimately empty can say so without being absent", () => {
  const properties = at([...STEP, "properties"]) as Record<string, { type?: string }>;

  // A string, so "" is an answer.
  assert.equal(properties.dependsOn?.type, "string");
  // Arrays, so [] is an answer.
  assert.equal(properties.requiredInputs?.type, "array");
  assert.equal(properties.resources?.type, "array");
  // An object with an empty category is an answer.
  assert.equal(properties.providerNeeded?.type, "object");
});

/**
 * The retry, and what happens if the retry does not help.
 *
 * A model with no schema enforcement can still leave a required field out, so
 * the drafter asks a second time where the answer is thin and says so on the
 * plan if it is still thin. `isThin` decides both, which makes it worth
 * pinning: too eager and every plan pays for a second call it did not need;
 * too lax and a plan with no schedule is saved as though it had one.
 */
function isThin(steps: { estimatedDays?: number; steps?: unknown[] }[]): boolean {
  if (steps.length === 0) return false;
  const missing = steps.filter(
    (step) =>
      typeof step?.estimatedDays !== "number" ||
      !Array.isArray(step?.steps) ||
      step.steps.length === 0,
  ).length;
  return missing > steps.length / 2;
}

test("a complete plan is not thin, however short", () => {
  const good = [{ estimatedDays: 1, steps: ["do it"] }];
  assert.equal(isThin(good), false);
});

test("a plan whose steps lost their durations is thin", () => {
  const dropped = [
    { steps: ["a"] },
    { steps: ["b"] },
    { estimatedDays: 2, steps: ["c"] },
  ];
  assert.equal(isThin(dropped), true);
});

test("one task short of detail does not trigger a second call", () => {
  const mostlyFine = [
    { estimatedDays: 1, steps: ["a"] },
    { estimatedDays: 2, steps: ["b"] },
    { estimatedDays: 1, steps: ["c"] },
    { steps: [] },
  ];
  assert.equal(isThin(mostlyFine), false);
});

test("an empty plan is not thin — there is nothing to be thin about", () => {
  assert.equal(isThin([]), false);
});

/**
 * A plan drafted without a search cannot carry a verified detail.
 *
 * On a real plan the lookup failed, and all four resources came back marked
 * verified with real-looking URLs. The mark said the opposite of the truth on
 * exactly the plan where it mattered — the rule about what "verified" means
 * was only in the prompt branch that runs when findings exist.
 *
 * The prompt says it in both branches now, and the answer is corrected on the
 * way out regardless, because whether a search returned anything is a fact we
 * hold rather than something to take the model's word for.
 */
type Resource = { phone?: string; email?: string; url?: string; verified?: boolean };

function withoutSources(resources: Resource[]): Resource[] {
  return resources.map((resource) => ({
    ...resource,
    phone: undefined,
    email: undefined,
    verified: false,
  }));
}

test("with no search, nothing survives as verified", () => {
  const claimed: Resource[] = [
    { url: "https://www.canada.ca", verified: true },
    { phone: "+1 800 000 0000", verified: true },
  ];

  assert.ok(withoutSources(claimed).every((row) => row.verified === false));
});

test("a number nobody checked is dropped, not labelled", () => {
  // A label does not help whoever answers the phone.
  const cleaned = withoutSources([{ phone: "+1 800 000 0000", email: "a@b.c", verified: true }]);
  assert.equal(cleaned[0]!.phone, undefined);
  assert.equal(cleaned[0]!.email, undefined);
});

test("the authority's own page survives, because the name is still worth having", () => {
  const cleaned = withoutSources([{ url: "https://www.tdsb.on.ca", verified: true }]);
  assert.equal(cleaned[0]!.url, "https://www.tdsb.on.ca");
});

/**
 * Dashes the model was asked not to use, removed anyway.
 *
 * A plan came back named "Toronto Relocation Plan — Rohail Khan Family", and
 * that one dash then appeared in the breadcrumb, the heading, the Ask Whitby
 * panel, the exported PDF and everywhere else the plan is named. Asking is a
 * request; this is the rule.
 */
function plain(value: string): string {
  return value.replace(/\s*[–—]\s*/g, ", ").replace(/,\s*,/g, ",").trim();
}

test("an em dash in a plan name becomes a comma", () => {
  assert.equal(
    plain("Toronto Relocation Plan — Rohail Khan Family"),
    "Toronto Relocation Plan, Rohail Khan Family",
  );
});

test("an en dash goes the same way", () => {
  assert.equal(plain("Q3 Review – Whitfield"), "Q3 Review, Whitfield");
});

test("a name with no dash is left exactly as it was", () => {
  assert.equal(plain("Corporate networking event"), "Corporate networking event");
});

test("a dash next to a comma does not leave two", () => {
  assert.equal(plain("Relocation, Toronto — Khan"), "Relocation, Toronto, Khan");
});
