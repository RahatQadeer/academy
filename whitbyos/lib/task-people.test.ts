import assert from "node:assert/strict";
import { test } from "node:test";
import { peopleOnTask, stepsLabel } from "./task-people.ts";

test("a task nobody split is one person holding every step", () => {
  const people = peopleOnTask("hazel", [{}, {}, {}]);

  assert.equal(people.length, 1);
  assert.deepEqual(people[0], { userId: "hazel", steps: [1, 2, 3], leads: true });
});

test("a step with its own owner puts a second person on the task", () => {
  const people = peopleOnTask("hazel", [
    {},
    { ownerUserId: "sabahat" },
    {},
    { ownerUserId: "sabahat" },
  ]);

  assert.deepEqual(people, [
    { userId: "hazel", steps: [1, 3], leads: true },
    { userId: "sabahat", steps: [2, 4], leads: false },
  ]);
});

test("the person the task belongs to comes first, whoever holds step one", () => {
  const people = peopleOnTask("hazel", [{ ownerUserId: "sabahat" }, {}]);

  assert.equal(people[0].userId, "hazel");
  assert.equal(people[0].leads, true);
  assert.deepEqual(people[0].steps, [2]);
});

test("a task with an owner and no steps is still that person's", () => {
  assert.deepEqual(peopleOnTask("hazel", []), [
    { userId: "hazel", steps: [], leads: true },
  ]);
});

test("an unowned task is nobody's, rather than everybody's", () => {
  assert.deepEqual(peopleOnTask(null, [{}, {}]), []);
});

test("an unowned task still names whoever holds a step of it", () => {
  assert.deepEqual(peopleOnTask(null, [{}, { ownerUserId: "sabahat" }]), [
    { userId: "sabahat", steps: [2], leads: false },
  ]);
});

test("steps read as runs, not as every number in them", () => {
  assert.equal(stepsLabel([]), "");
  assert.equal(stepsLabel([3]), "step 3");
  assert.equal(stepsLabel([1, 2, 3, 4]), "steps 1 to 4");
  assert.equal(stepsLabel([2, 5]), "steps 2 and 5");
  assert.equal(stepsLabel([1, 2, 5]), "steps 1 to 2 and 5");
  assert.equal(stepsLabel([1, 2, 5, 6, 9]), "steps 1 to 2, 5 to 6 and 9");
});
