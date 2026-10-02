import test from "node:test";
import assert from "node:assert/strict";
import { groupCatalogPrograms, isNewCatalogProgram } from "./catalogSequence.ts";
import type { ExploreProgramCard } from "../types.ts";

function card(partial: Partial<ExploreProgramCard> & Pick<ExploreProgramCard, "id" | "name" | "type">): ExploreProgramCard {
  return {
    accessMode: "free",
    recognition: "certificate_of_completion",
    learningPath: "business_and_practice",
    category: null,
    description: null,
    coverImageUrl: null,
    price: null,
    createdAt: null,
    prerequisiteProgramId: null,
    prerequisiteName: null,
    enrollmentStatus: null,
    access: { kind: "available", label: "Start", href: `/academy/explore/${partial.id}`, muted: false },
    moduleCount: 1,
    skillsGained: [],
    ...partial,
  };
}

test("groups programs by certificate classification", () => {
  const sections = groupCatalogPrograms([
    card({
      id: "1",
      name: "Certified Private Attaché",
      type: "certification_program",
      recognition: "professional_certification",
    }),
    card({
      id: "2",
      name: "Aviation Endorsement",
      type: "endorsement_program",
      recognition: "specialty_endorsement",
    }),
    card({
      id: "3",
      name: "Free intro",
      type: "short_course",
      recognition: "certificate_of_completion",
    }),
  ]);
  assert.deepEqual(
    sections.map((section) => section.id),
    ["professional", "endorsements", "completion"],
  );
});

test("treats programs created in the last 45 days as new", () => {
  const now = Date.parse("2026-09-18T00:00:00.000Z");
  assert.equal(isNewCatalogProgram({ createdAt: "2026-08-20T00:00:00.000Z" }, now), true);
  assert.equal(isNewCatalogProgram({ createdAt: "2026-06-01T00:00:00.000Z" }, now), false);
});
