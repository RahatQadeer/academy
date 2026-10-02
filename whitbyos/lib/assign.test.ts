import assert from "node:assert/strict";
import { test } from "node:test";
import { assignRole, type Assignable } from "./assign.ts";

/** The firm the first real plan was drafted in: an owner and one team lead. */
const SMALL: Assignable[] = [
  { userId: "owner-1", role: "owner" },
  { userId: "lead-1", role: "team_lead" },
];

/** Hand out `count` steps of the same role and report who got how many. */
function deal(role: string | undefined, people: Assignable[], count: number) {
  const taken = new Map<string, number>();
  const out: (string | null)[] = [];

  for (let i = 0; i < count; i += 1) {
    const who = assignRole(role, people, taken);
    if (who) taken.set(who, (taken.get(who) ?? 0) + 1);
    out.push(who);
  }

  return { out, taken };
}

test("work nobody claimed is shared, not stacked on one person", () => {
  // The bug: fifteen steps, every one of them on the single team lead.
  const { taken } = deal("any", SMALL, 15);
  assert.equal(taken.get("lead-1"), 8);
  assert.equal(taken.get("owner-1"), 7);
});

test("a step with no role at all is treated as any", () => {
  const { taken } = deal(undefined, SMALL, 4);
  assert.equal(taken.get("lead-1"), 2);
  assert.equal(taken.get("owner-1"), 2);
});

test("a named role beats load — billing work goes to billing", () => {
  const people: Assignable[] = [
    { userId: "owner-1", role: "owner" },
    { userId: "bill-1", role: "billing" },
  ];

  const { out } = deal("billing", people, 3);
  assert.deepEqual(out, ["bill-1", "bill-1", "bill-1"]);
});

test("a named role falls back when nobody holds it", () => {
  // No coordinator in this firm, so the chain reaches the team lead.
  const { out } = deal("coordinator", SMALL, 1);
  assert.deepEqual(out, ["lead-1"]);
});

test("a role nobody holds is shared out, not piled on the first substitute", () => {
  // The case from a real plan: nine tasks all asking for a coordinator, in a
  // firm of an owner and one team lead. Every one landed on the team lead and
  // the owner did none of it.
  const { taken } = deal("coordinator", SMALL, 9);
  assert.equal(taken.get("lead-1"), 5);
  assert.equal(taken.get("owner-1"), 4);
});

const FIRM: Assignable[] = [
  { userId: "co-1", role: "coordinator" },
  { userId: "lead-1", role: "team_lead" },
  { userId: "owner-1", role: "owner" },
];

test("an exact match takes its own work", () => {
  // Being asked for by name is not a compromise, and a plan with two or three
  // coordinator steps in it should put them on the coordinator.
  const { taken } = deal("coordinator", FIRM, 3);
  assert.equal(taken.get("co-1"), 3);
  assert.equal(taken.get("lead-1"), undefined);
});

test("until it would hand one person the whole plan", () => {
  // Fifteen steps asking for the one coordinator is not a preference being
  // honoured, it is one person holding everything while the two people the
  // chain says could help hold nothing.
  const { taken } = deal("coordinator", FIRM, 15);

  assert.ok((taken.get("co-1") ?? 0) < 15, "the coordinator does not take all fifteen");
  assert.ok((taken.get("lead-1") ?? 0) > 0, "the team lead takes some of it");
  assert.ok((taken.get("owner-1") ?? 0) > 0, "so does the owner");
});

test("nobody carries the plan alone where somebody else could help", () => {
  const { taken } = deal("coordinator", FIRM, 15);
  const shares = [...taken.values()].sort((a, b) => b - a);

  // The heaviest share is not more than double the lightest.
  assert.ok(shares[0]! <= shares[shares.length - 1]! * 2, `shares were ${shares.join(", ")}`);
});

test("but a firm of one still gives that one person everything", () => {
  // There is nobody to share with, and leaving the work unassigned to make a
  // chart look fair would help nobody.
  const alone: Assignable[] = [{ userId: "owner-1", role: "owner" }];
  const { taken } = deal("owner", alone, 9);
  assert.equal(taken.get("owner-1"), 9);
});

test("two people of the same role split the work between them", () => {
  const people: Assignable[] = [
    { userId: "co-1", role: "coordinator" },
    { userId: "co-2", role: "coordinator" },
    { userId: "owner-1", role: "owner" },
  ];

  const { taken } = deal("coordinator", people, 4);
  assert.equal(taken.get("co-1"), 2);
  assert.equal(taken.get("co-2"), 2);
  assert.equal(taken.get("owner-1"), undefined);
});

test("an empty workspace leaves the step unassigned rather than guessing", () => {
  assert.equal(assignRole("any", [], new Map()), null);
});

test("a role nobody in the chain holds leaves the step unassigned", () => {
  const outsiders: Assignable[] = [{ userId: "guest-1", role: "client" }];
  assert.equal(assignRole("any", outsiders, new Map()), null);
});

test("the same plan drafted twice hands out the same work", () => {
  const first = deal("any", SMALL, 9).out;
  const second = deal("any", [...SMALL].reverse(), 9).out;
  assert.deepEqual(first, second);
});
