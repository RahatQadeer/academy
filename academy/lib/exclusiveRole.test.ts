import assert from "node:assert/strict";
import test from "node:test";
import { pickExclusiveAcademyRole } from "./exclusiveRolePick.ts";

test("exclusive role prefers super_admin over admin", () => {
  assert.equal(pickExclusiveAcademyRole(["admin", "super_admin"]), "super_admin");
  assert.equal(pickExclusiveAcademyRole(["learner", "admin"]), "admin");
  assert.equal(pickExclusiveAcademyRole(["learner", "instructor"]), "instructor");
  assert.equal(pickExclusiveAcademyRole(["learner"]), "learner");
  assert.equal(pickExclusiveAcademyRole([]), null);
});
