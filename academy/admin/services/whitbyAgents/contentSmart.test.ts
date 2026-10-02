import assert from "node:assert/strict";
import test from "node:test";

import {
  isBeautifyRequest,
  isConversationalAsk,
  looksLikeMutation,
  wantsEdit,
} from "./fuzzy.ts";
import {
  tryInferDefinitionParagraph,
  tryInferScenarioParagraph,
  tryParseExampleParagraph,
  tryParseSummaryParagraph,
} from "../../../lib/lessonContentDesign.ts";

test("style / format commands are beautify edits", () => {
  const asks = [
    "Style the course content",
    "Put all scenarios into scenario boxes",
    "Fix the formatting but don't change the actual content",
    "Convert all code into VS Code blocks",
    "Make the learning objectives stand out",
  ];
  for (const ask of asks) {
    assert.equal(isBeautifyRequest(ask), true, ask);
    assert.equal(wantsEdit(ask), true, ask);
    assert.equal(looksLikeMutation(ask), true, ask);
    assert.equal(isConversationalAsk(ask), false, ask);
  }
});

test("semantic definition inference without Definition label", () => {
  const parsed = tryInferDefinitionParagraph(
    "A variable is a named storage location used to hold data in a program.",
  );
  assert.ok(parsed);
  assert.equal(parsed!.term.toLowerCase(), "variable");
  assert.match(parsed!.meaning, /named storage location/i);
});

test("semantic scenario inference from Imagine…", () => {
  const parsed = tryInferScenarioParagraph(
    "Imagine you are working as a backend developer and your API suddenly receives 10,000 requests in one minute. What should you do first?",
  );
  assert.ok(parsed);
  assert.match(parsed!.situation, /Imagine you are working/i);
});

test("example and summary shapes parse", () => {
  const example = tryParseExampleParagraph(
    "Example — Compiling Hello.java\nRun javac Hello.java then java Hello.",
  );
  assert.ok(example);
  assert.equal(example!.title, "Compiling Hello.java");

  const summary = tryParseSummaryParagraph(
    "Summary — What you can do now\n- Install the JDK\n- Compile a class",
  );
  assert.ok(summary);
  assert.match(summary!.body, /Install the JDK/);
});
