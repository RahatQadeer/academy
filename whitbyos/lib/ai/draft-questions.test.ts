import assert from "node:assert/strict";
import { test } from "node:test";
import { tidy } from "./question-guard.ts";

/**
 * The guard between the model and the screen.
 *
 * Every rule here is one the prompt already states, and every one of them
 * was written after the model broke it once. A weak question is not a weak
 * question: it is somebody deciding this screen is a toll gate and clicking
 * through it forever, on the work where it would have mattered.
 */

const ask = (question: string, extra: Record<string, unknown> = {}) => ({
  question,
  why: "It changes the plan.",
  ...extra,
});

test("a question that could be asked of any piece of work is dropped", () => {
  const kept = tidy([
    ask("What is the budget?"),
    ask("Is there a deadline?"),
    ask("Anything else we should know?"),
    ask("Which visa route is the family applying under?"),
  ]);

  assert.deepEqual(
    kept.map((row) => row.question),
    ["Which visa route is the family applying under?"],
  );
});

test("the same question twice, worded differently, is asked once", () => {
  const kept = tidy([
    ask("Which visa route is the family applying under?"),
    ask("which visa route is the family applying under"),
  ]);

  assert.equal(kept.length, 1);
});

test("at most four survive, however many arrive", () => {
  const kept = tidy(
    Array.from({ length: 9 }, (_, index) => ask(`Question number ${index} about the work?`)),
  );

  assert.equal(kept.length, 4);
});

test("a single option is not a choice", () => {
  const [one] = tidy([ask("Which route?", { options: ["Skilled Worker"] })]);
  assert.equal(one!.options, null);

  const [two] = tidy([ask("Which route?", { options: ["Skilled Worker", "Student"] })]);
  assert.deepEqual(two!.options, ["Skilled Worker", "Student"]);
});

test("no more than four options, and blank ones are not offered", () => {
  const [row] = tidy([
    ask("Which route?", { options: ["A", "B", "C", "D", "E", "  ", ""] }),
  ]);

  assert.deepEqual(row!.options, ["A", "B", "C", "D"]);
});

test("a question is punctuated as one", () => {
  const [row] = tidy([ask("Which route is the family applying under")]);
  assert.equal(row!.question, "Which route is the family applying under?");
});

test("the house style's dashes do not survive", () => {
  const [row] = tidy([ask("Which route — the Skilled Worker one — applies?")]);
  assert.ok(!row!.question.includes("—"));
  assert.ok(!row!.question.includes("–"));
});

test("an empty answer from the model is an empty list, not a crash", () => {
  assert.deepEqual(tidy(undefined), []);
  assert.deepEqual(tidy([]), []);
  assert.deepEqual(tidy([ask("   ")]), []);
});

/**
 * Told the deadline, the model stops asking for it and starts asking about
 * it. These are the real questions it produced on a plan whose form already
 * carried 27 March 2027, on the screen straight after the date picker.
 */
test("a question about the date is dropped when the form already carried one", () => {
  const rows = [
    ask("Is the wedding date fixed to a specific day at the end of March, or is it still flexible?"),
    ask("Do the six UK guests already hold valid Pakistani visas, or do they need to apply?"),
  ];

  const kept = tidy(rows, { hasTargetDate: true });

  assert.equal(kept.length, 1);
  assert.ok(kept[0].question.startsWith("Do the six UK guests"));
});

test("the same question survives when no date was given", () => {
  const rows = [ask("Is the wedding date fixed, or is it still flexible?")];

  assert.equal(tidy(rows, { hasTargetDate: false }).length, 1);
  assert.equal(tidy(rows).length, 1);
});

test("every wording of when is caught", () => {
  for (const question of [
    "Is the date fixed or still open?",
    "What is the deadline for the shipment?",
    "What timeline are you working to?",
    "When is the family arriving?",
    "How soon do you need the shortlist?",
    "Does everything have to be complete by the end of March?",
  ]) {
    assert.equal(
      tidy([ask(question)], { hasTargetDate: true }).length,
      0,
      `survived: ${question}`,
    );
  }
});

test("a question that merely mentions work near a date is still dropped, deliberately", () => {
  /* "Updated" carries no date word, so it stays. The rule is about the word,
     not about a judgement of intent: a guard that tried to tell a useful
     date question from a useless one would be the prompt again. */
  const kept = tidy([ask("Has the guest list been updated since you last saw it?")], {
    hasTargetDate: true,
  });

  assert.equal(kept.length, 1);
});
