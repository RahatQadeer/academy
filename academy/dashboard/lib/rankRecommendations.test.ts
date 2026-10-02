import test from "node:test";
import assert from "node:assert/strict";
import { rankRecommendedPrograms, recommendedAction } from "./rankRecommendations.ts";

test("ranks specialty programs first when the learner chose a specialty interest", () => {
  const ranked = rankRecommendedPrograms(
    [
      { name: "Certified Private Attaché", type: "certification_program" as const },
      { name: "Family Office Endorsement", type: "endorsement_program" as const },
      { name: "Free intro", type: "short_course" as const },
    ],
    ["specialty"],
  );
  assert.equal(ranked[0]?.name, "Family Office Endorsement");
});

test("does not lock specialty endorsements behind Certified Private Attaché", () => {
  assert.equal(recommendedAction("endorsement_program"), "view");
  assert.equal(recommendedAction("short_course"), "start");
});
