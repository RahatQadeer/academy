import assert from "node:assert/strict";
import { test } from "node:test";
import { tidy } from "./proposal-guard.ts";

/**
 * The guard on the only generated text in this product a client reads.
 *
 * Everything else the model writes stays inside the firm, where a bad line
 * costs a professional a minute. This goes out under the firm's name, to the
 * person paying for the work, as the firm's own suggestion. Each test is a
 * way one could have embarrassed somebody.
 */

/** The slugger the real caller passes: `needSlug`, near enough for matching. */
const slug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const menu = { label: "Wedding menu", text: "Starter: soup or salad.\nMain: lamb or aubergine." };

test("a usable suggestion comes through whole", () => {
  const out = tidy([menu], slug);

  assert.equal(out.length, 1);
  assert.equal(out[0].label, "Wedding menu");
  assert.equal(out[0].text, "Starter: soup or salad.\nMain: lamb or aubergine.");
});

test("nothing usable comes back as an empty list, never as a blank proposal", () => {
  assert.deepEqual(tidy(null, slug), []);
  assert.deepEqual(tidy(undefined, slug), []);
  assert.deepEqual(tidy([], slug), []);
  assert.deepEqual(tidy([{ label: "Menu", text: "" }], slug), []);
  assert.deepEqual(tidy([{ label: "", text: "A real suggestion here." }], slug), []);
  assert.deepEqual(tidy("not a list" as never, slug), []);
});

test("a one-word answer is the model restating the label, not a suggestion", () => {
  assert.deepEqual(tidy([{ label: "Wedding menu", text: "A menu." }], slug), []);
});

test("a covering-letter opener is stripped, because this lands in a form field", () => {
  const out = tidy(
    [{ label: "Menu", text: "Here is a suggested menu:\nStarter: soup.\nMain: lamb." }],
    slug,
  );

  assert.equal(out[0].text, "Starter: soup.\nMain: lamb.");
});

test("each opener form is caught", () => {
  for (const opener of [
    "Dear Mr Khan,",
    "Hi there,",
    "Below is our suggestion:",
    "I have drafted the following:",
    "We have prepared this:",
    "Please find the suggestion below:",
    "Based on what you told us:",
  ]) {
    const out = tidy([{ label: "Menu", text: `${opener}\nStarter: soup, main: lamb.` }], slug);

    assert.equal(out.length, 1, `${opener} produced nothing`);
    assert.ok(
      out[0].text.startsWith("Starter"),
      `${opener} survived as: ${out[0].text.slice(0, 40)}`,
    );
  }
});

test("only the first opener is stripped, so real content is not eaten", () => {
  const out = tidy(
    [{ label: "Brief", text: "Here is the brief:\nBased on the venue, we suggest two rooms." }],
    slug,
  );

  assert.equal(out[0].text, "Based on the venue, we suggest two rooms.");
});

test("em and en dashes are replaced", () => {
  const out = tidy([{ label: "Menu", text: "Starter — soup. Main – lamb." }], slug);

  assert.ok(!out[0].text.includes("—"));
  assert.ok(!out[0].text.includes("–"));
});

test("the same need suggested twice keeps one", () => {
  const out = tidy(
    [menu, { label: "wedding  menu", text: "A different second attempt entirely." }],
    slug,
  );

  assert.equal(out.length, 1);
  assert.equal(out[0].text, menu.text);
});

test("a label that slugs to nothing is dropped, because it matches no need", () => {
  assert.deepEqual(tidy([{ label: "!!!", text: "A perfectly good suggestion." }], slug), []);
});

test("line breaks survive, because a menu is a list", () => {
  const out = tidy([{ label: "Order", text: "1. Arrive\n2. Speeches\n3. Dinner" }], slug);

  assert.equal(out[0].text, "1. Arrive\n2. Speeches\n3. Dinner");
});

test("padding with blank lines does not make a suggestion look longer", () => {
  const out = tidy([{ label: "Order", text: "Arrive.\n\n\n\n\nSpeeches." }], slug);

  assert.equal(out[0].text, "Arrive.\n\nSpeeches.");
});

test("a very long suggestion is cut at a line or a sentence", () => {
  const out = tidy([{ label: "Menu", text: `${"Course of food. ".repeat(200)}` }], slug);

  assert.ok(out[0].text.length <= 1200);
  assert.ok(out[0].text.endsWith("."));
});

/**
 * The question written out again instead of answered.
 *
 * All five are the model's real output on Test 06, where every label named an
 * approval and it wrote about the approval. A box saying "Not yet chosen.
 * What is needed: which menu option the family wants" is the blank box this
 * whole feature replaces, with more words in it.
 */
test("a restatement of the question is dropped, not shown as a suggestion", () => {
  for (const text of [
    "Not yet chosen. The caterer will not finalise without the family's pick.",
    "Not yet set. Two things to settle with the family: date and guest count.",
    "Not yet given. The sequence and timings have to be agreed first.",
    "To be confirmed with the family before suppliers are briefed.",
    "None yet. The family has to tell us which option they want.",
    "Nothing has been decided about the running order at this stage.",
  ]) {
    assert.deepEqual(tidy([{ label: "Menu", text }], slug), [], `survived: ${text}`);
  }
});

test("a What is needed heading anywhere in the text drops it", () => {
  const text = "The menu options are below.\nWhat is needed: which one the family wants.";

  assert.deepEqual(tidy([{ label: "Menu", text }], slug), []);
});

test("a real draft that merely mentions what is not settled survives", () => {
  /* The rule is about the shape of the answer, not the word "not". A menu
     with a blank in it is still a menu. */
  const text = "Starter: soup or salad.\nMain: lamb or aubergine.\nSpeech, [name not yet given].";
  const out = tidy([{ label: "Menu", text }], slug);

  assert.equal(out.length, 1);
  assert.ok(out[0].text.startsWith("Starter"));
});

test("a blank that says to be confirmed is the restatement hiding in brackets", () => {
  const text = "Date: [date to be confirmed]\nGuests: [number to be confirmed]";

  assert.deepEqual(tidy([{ label: "Date", text }], slug), []);
});

test("an ordinary blank survives, because a blank is how a draft leaves room", () => {
  const text = "[time] Guests arrive\n[time] Welcome speech, [name]\n[time] Cake cutting";
  const out = tidy([{ label: "Order", text }], slug);

  assert.equal(out.length, 1);
  assert.ok(out[0].text.includes("[name]"));
});

test("the firm's own filing language never reaches the client", () => {
  for (const text of [
    "Date: [date] (the work is due 2027-03-28, so the wedding falls before it)",
    "The deadline is 28 March, so the venue has to be booked before then.",
  ]) {
    assert.deepEqual(tidy([{ label: "Date", text }], slug), [], `survived: ${text}`);
  }
});

test("an ordinary date in a draft is not filing language", () => {
  const out = tidy(
    [{ label: "Order", text: "28 March 2027\n6:00pm Guests arrive\n6:30pm Nikkah" }],
    slug,
  );

  assert.equal(out.length, 1);
});
