import assert from "node:assert/strict";
import { test } from "node:test";
import { tidy, MOST_SECTIONS, MOST_OPEN_POINTS } from "./auto-draft-guard.ts";

/**
 * The guard between the model and a task the professional will trust.
 *
 * This draft is shown as work Whitby did, which is a stronger claim than a
 * suggestion: somebody reads it and carries on from it. So the failure that
 * matters here is not an ugly draft, it is a draft that looks finished. Each
 * test is a way one could have.
 */

const section = (heading: string, body = "Something worked out.") => ({ heading, body });

const draft = (extra: Record<string, unknown> = {}) => ({
  summary: "A checklist of what the form needs.",
  sections: [section("What the form asks for")],
  openPoints: [],
  ...extra,
});

test("nothing usable comes back as null rather than as an empty draft", () => {
  assert.equal(tidy(null), null);
  assert.equal(tidy(undefined), null);
  assert.equal(tidy({}), null);
  assert.equal(tidy(draft({ sections: [] })), null);
  assert.equal(tidy(draft({ sections: "not a list" as never })), null);
});

test("a heading with no body under it is dropped, not shown empty", () => {
  const out = tidy(draft({ sections: [section("Evidence", "   "), section("Fees", "Two.")] }));

  assert.deepEqual(
    out?.sections.map((row) => row.heading),
    ["Fees"],
  );
});

test("a body with no heading is dropped", () => {
  const out = tidy(draft({ sections: [{ heading: "", body: "Real material." }] }));

  assert.equal(out, null);
});

test("sections are capped, so a first pass cannot become a document", () => {
  const many = Array.from({ length: 20 }, (_, i) => section(`Part ${i}`));
  const out = tidy(draft({ sections: many }));

  assert.equal(out?.sections.length, MOST_SECTIONS);
});

test("the same heading twice keeps one", () => {
  const out = tidy(
    draft({ sections: [section("Evidence", "One."), section("evidence", "Two.")] }),
  );

  assert.equal(out?.sections.length, 1);
});

test("open points are capped and de-duplicated", () => {
  const out = tidy(
    draft({
      openPoints: [
        "The CoS reference number.",
        "the cos reference number",
        ...Array.from({ length: 10 }, (_, i) => `Fact ${i}`),
      ],
    }),
  );

  assert.equal(out?.openPoints.length, MOST_OPEN_POINTS);
  assert.equal(out?.openPoints[0], "The CoS reference number.");
  assert.equal(out?.openPoints[1], "Fact 0");
});

test("an empty open points list is allowed", () => {
  const out = tidy(draft({ openPoints: [] }));

  assert.deepEqual(out?.openPoints, []);
});

test("em and en dashes are replaced rather than left in", () => {
  const out = tidy(
    draft({
      summary: "A checklist — the first pass.",
      sections: [section("Fees – and who pays", "Employer pays — confirmed in writing.")],
      openPoints: ["Who signs — the registrar or the head."],
    }),
  );

  const all = [
    out?.summary,
    out?.sections[0].heading,
    out?.sections[0].body,
    out?.openPoints[0],
  ].join(" ");

  assert.ok(!all.includes("—"), "an em dash survived");
  assert.ok(!all.includes("–"), "an en dash survived");
  assert.ok(out?.summary.includes("checklist, the first pass"));
});

test("the body keeps its line breaks, because a checklist is a list", () => {
  const out = tidy(draft({ sections: [section("Steps", "1. One\n2. Two\n3. Three")] }));

  assert.equal(out?.sections[0].body, "1. One\n2. Two\n3. Three");
});

test("padding a body with blank lines does not make the draft look longer", () => {
  const out = tidy(draft({ sections: [section("Steps", "One\n\n\n\n\nTwo")] }));

  assert.equal(out?.sections[0].body, "One\n\nTwo");
});

test("a missing summary falls back to the first heading, never to nothing", () => {
  const out = tidy(draft({ summary: "", sections: [section("What the form asks for")] }));

  assert.equal(out?.summary, "What the form asks for");
});

test("a long summary is cut at a word, not mid-word", () => {
  const out = tidy(draft({ summary: `${"word ".repeat(80)}end` }));

  assert.ok((out?.summary.length ?? 0) <= 220);
  assert.ok(!out?.summary.endsWith("wor"));
});

/**
 * Long is not the same as full.
 *
 * The school longlist came back with forty rows reading "Beaver Road Primary
 * School, [address verify], admissions contact [verify], deadline [verify],
 * distance [blank], car time [blank]": one fact and five placeholders, forty
 * times. Long to read and almost nothing in it.
 */
const blankRow = (n: number) =>
  `School ${n}, [address verify], admissions contact [verify], deadline [verify], distance [blank]`;

test("a few marked blanks are how a draft leaves room", () => {
  const body = [blankRow(1), blankRow(2), blankRow(3)].join("\n");
  const out = tidy(draft({ sections: [section("Schools", body)] }));

  assert.equal(out?.sections[0].body, body);
});

test("forty rows of blanks are padding, and are said rather than printed", () => {
  const body = Array.from({ length: 40 }, (_, i) => blankRow(i)).join("\n");
  const out = tidy(draft({ sections: [section("Schools", body)] }));

  const lines = out!.sections[0].body.split("\n");
  assert.ok(lines.length <= 6, `kept ${lines.length} lines`);
  assert.ok(lines[lines.length - 1].includes("more rows like these were left out"));
});

test("a real list is not mistaken for padding", () => {
  const body = [
    "Manchester Grammar School, boys, Year 7 entry, assessment in January",
    "Withington Girls' School, girls, Year 7 entry, assessment in January",
    "Cheadle Hulme School, co-ed, Reception and Year 7, closer to Stockport",
  ].join("\n");
  const out = tidy(draft({ sections: [section("Independents", body)] }));

  assert.equal(out?.sections[0].body, body);
});

test("the whole draft is capped, by dropping whole sections from the end", () => {
  const long = "x".repeat(400);
  const out = tidy(
    draft({
      sections: Array.from({ length: 6 }, (_, i) => section(`Part ${i}`, long)),
    }),
  );

  const total = out!.sections.reduce((n, p) => n + p.heading.length + p.body.length, 0);
  assert.ok(total <= 1200 + 400, `draft was ${total} characters`);
  assert.ok(out!.sections.length < 6);
  /* Never half a section: the mid-sentence stop this guard got wrong once. */
  assert.ok(out!.sections.every((p) => p.body.length === long.length));
});
