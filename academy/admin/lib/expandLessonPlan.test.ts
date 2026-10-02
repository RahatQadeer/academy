import test from "node:test";
import assert from "node:assert/strict";
import { expandPlanToLessonBody, isSyntheticLessonBody } from "./expandLessonPlan.ts";
import { lessonNeedsTeachingBody, teachingContentIsComplete } from "./courseAttachmentText.ts";

function prose(words: number) {
  return Array.from(
    { length: words },
    () => "Firewalls inspect packets at the network boundary and compare each request to a rule set.",
  )
    .join(" ")
    .split(/\s+/)
    .slice(0, words)
    .join(" ");
}

test("expandPlanToLessonBody writes teaching paragraphs, not an empty lesson", () => {
  const body = expandPlanToLessonBody({
    title: "JWT Payload Design and the Stateless Trust Boundary",
    summary:
      "An intermediate reading that dissects what a JWT should and should not carry in the MERN e-commerce app.",
    learningObjectives: [
      "Design a JWT payload that carries userId, role, and tokenVersion.",
      "Explain why a valid signature proves integrity and not authority.",
    ],
    outline: ["Claims versus permissions", "Tampering that still verifies"],
  });
  assert.match(body, /JWT Payload|Stateless|tokenVersion|Claims versus permissions/);
  assert.ok(body.split(/\s+/).length > 120);
  assert.doesNotMatch(body, /^# Module 1/m);
  assert.equal(isSyntheticLessonBody(body), true);
  assert.equal(teachingContentIsComplete(body, "intermediate", "reading"), false);
});

test("lessonNeedsTeachingBody treats empty and synthetic bodies as unfinished", () => {
  assert.equal(lessonNeedsTeachingBody("reading", ""), true);
  assert.equal(lessonNeedsTeachingBody("scenario", null), true);
  assert.equal(lessonNeedsTeachingBody("quiz", ""), false);
  assert.equal(lessonNeedsTeachingBody("assignment", ""), true);
  const teaching = prose(700);
  assert.equal(lessonNeedsTeachingBody("reading", teaching), false);
  assert.equal(teachingContentIsComplete(teaching, "beginner", "reading"), true);
  assert.equal(teachingContentIsComplete("", "advanced", "reading"), false);
});

test("teachingContentIsComplete honors selected level floors", () => {
  const short = prose(430);
  assert.equal(teachingContentIsComplete(short, "beginner", "reading"), true);
  assert.equal(teachingContentIsComplete(short, "intermediate", "reading"), false);
  assert.equal(teachingContentIsComplete(short, "advanced", "reading"), false);
  assert.equal(teachingContentIsComplete(prose(640), "advanced", "reading"), true);
  assert.equal(teachingContentIsComplete(prose(180), "intermediate", "assignment"), false);
  assert.equal(teachingContentIsComplete(prose(240), "intermediate", "assignment"), true);
});
