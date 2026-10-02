import { SectionHeader } from "@/academy/components/ui";
import type { ExploreCatalogQuery, ExploreProgramCard } from "../types";
import { groupCatalogPrograms, shouldGroupCatalog } from "../utils/catalogSequence";
import { ProgramGrid } from "./ProgramGrid";

export function ProgramCatalog({
  programs,
  query,
  recommended = [],
}: {
  programs: ExploreProgramCard[];
  query: ExploreCatalogQuery;
  recommended?: ExploreProgramCard[];
}) {
  if (!shouldGroupCatalog(query) || programs.length <= 1) {
    return <ProgramGrid programs={programs} />;
  }

  const sections = groupCatalogPrograms(programs);
  const recommendedSection =
    recommended.length > 0
      ? {
          id: "recommended",
          title: "Recommended for you",
          description: "Based on the interests you chose during onboarding.",
          programs: recommended,
        }
      : null;
  const display = recommendedSection ? [recommendedSection, ...sections] : sections;
  if (display.length <= 1) {
    return <ProgramGrid programs={programs} />;
  }

  return (
    <div className="space-y-10">
      {display.map((section) => (
        <section key={section.id} aria-labelledby={`explore-${section.id}`}>
          <SectionHeader
            id={`explore-${section.id}`}
            title={section.title}
            description={`${section.description} ${section.programs.length} program${
              section.programs.length === 1 ? "" : "s"
            }.`}
          />
          <div className="mt-4">
            <ProgramGrid programs={section.programs} />
          </div>
        </section>
      ))}
    </div>
  );
}
