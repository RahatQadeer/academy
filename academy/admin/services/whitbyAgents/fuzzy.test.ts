import assert from "node:assert/strict";
import test from "node:test";

import {
  asksAboutLastChange,
  isBeautifyRequest,
  isConversationalAsk,
  isFormatRequest,
  isHeadingRenameRequest,
  isQualityQuestion,
  looksLikeCourseCommand,
  looksLikeMutation,
  wantsAdd,
  wantsDeeperContent,
  wantsEdit,
  wantsProgramOverview,
  wantsUndoChanges,
} from "./fuzzy.ts";

test("why-questions are diagnoses, not rewrite commands", () => {
  const question = "why course content not in depth in module 1 lesson 1?";
  assert.equal(isQualityQuestion(question), true);
  assert.equal(wantsDeeperContent(question), false);
  assert.equal(looksLikeMutation(question), false);
  assert.equal(wantsProgramOverview(question), false);
});

test("commands still deepen", () => {
  assert.equal(wantsDeeperContent("make this more in-depth"), true);
  assert.equal(wantsDeeperContent("deepen 1.1"), true);
  assert.equal(wantsDeeperContent("go deeper"), true);
  assert.equal(isQualityQuestion("make this more in-depth"), false);
  assert.equal(isQualityQuestion("can you make lesson 1 more in depth?"), false);
});

test("wantsDeeperContent does not steal ordinary add/edit asks", () => {
  assert.equal(wantsDeeperContent("add a basic lesson about darts"), false);
  assert.equal(wantsDeeperContent("add an assignment brief to this"), false);
  assert.equal(wantsDeeperContent("rename the course"), false);
  assert.equal(wantsDeeperContent("add a quiz after 1.2"), false);
});

test("wantsProgramOverview ignores course CONTENT complaints", () => {
  assert.equal(wantsProgramOverview("why the course content is not in depth"), false);
  assert.equal(wantsProgramOverview("I'm talking about the course content"), false);
  assert.equal(wantsProgramOverview("I meant the course name"), true);
  assert.equal(wantsProgramOverview("change the program title"), true);
});

test("make it bold is format, not add lesson", () => {
  const bold = "in module 1 lesson 1 in key takeway section make it bold the tetx";
  assert.equal(isFormatRequest(bold), true);
  assert.equal(wantsAdd(bold), false);
  assert.equal(isConversationalAsk(bold), false);
  assert.equal(looksLikeMutation(bold), true);
  assert.equal(wantsAdd("make a quiz about loops"), true);
  assert.equal(isFormatRequest("make a quiz about loops"), false);
});

test("what you do is chat, not mutate", () => {
  assert.equal(isConversationalAsk("what you do?"), true);
  assert.equal(isConversationalAsk("what did you change?"), true);
  assert.equal(looksLikeMutation("what you do?"), false);
  assert.equal(wantsAdd("what you do?"), false);
});

test("heading change name edits the lesson, not a summary answer", () => {
  const ask =
    "in module 1 lesson 1 a component is just a function heading change name";
  assert.equal(isHeadingRenameRequest(ask), true);
  assert.equal(isConversationalAsk(ask), false);
  assert.equal(looksLikeMutation(ask), true);
  assert.equal(wantsAdd(ask), false);
});

test("asksAboutLastChange is not undo", () => {
  assert.equal(asksAboutLastChange("where is the changes?"), true);
  assert.equal(asksAboutLastChange("can you tell me what you change?"), true);
  assert.equal(asksAboutLastChange("what did you change?"), true);
  assert.equal(wantsUndoChanges("where is the changes?"), false);
  assert.equal(wantsUndoChanges("can you tell me what you change?"), false);
  assert.equal(wantsUndoChanges("undo"), true);
  assert.equal(looksLikeCourseCommand("where is the changes?"), false);
  assert.equal(looksLikeCourseCommand("what you change?"), false);
});

test("looksLikeCourseCommand catches messy edit English", () => {
  assert.equal(
    looksLikeCourseCommand(
      "in module 1 lesson 1 a component is just a function heading change name",
    ),
    true,
  );
  assert.equal(looksLikeCourseCommand("what you do?"), false);
  assert.equal(looksLikeCourseCommand("make key takeaways bold"), true);
});

test("beautify / definition cards is an edit, not chat", () => {
  const asks = [
    "make this lesson beautiful",
    "put JDK and JRE in definition cards",
    "format definitions as cards",
    "make the definitions look professional",
    "beautify this",
  ];
  for (const ask of asks) {
    assert.equal(isBeautifyRequest(ask), true, ask);
    assert.equal(wantsEdit(ask), true, ask);
    assert.equal(looksLikeMutation(ask), true, ask);
    assert.equal(isConversationalAsk(ask), false, ask);
    assert.equal(looksLikeCourseCommand(ask), true, ask);
  }
  assert.equal(isBeautifyRequest("make a quiz about loops"), false);
});
