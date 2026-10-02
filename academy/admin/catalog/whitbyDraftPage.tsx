import { Callout } from "@/base/components/Callout";
import { loadCatalogProgram } from "./services/loadCatalogProgram";
import { WhitbyDraftView } from "./components/WhitbyDraftView";

export async function CatalogWhitbyDraftPage({ programId }: { programId: string }) {
  const result = await loadCatalogProgram(programId);

  if (!result.ok) {
    return (
      <div className="px-6 py-10 lg:px-14">
        <Callout tone="warning" title="Draft unavailable">
          The generated draft could not be loaded.
        </Callout>
      </div>
    );
  }

  return (
    <WhitbyDraftView
      programName={result.program.name}
      programId={programId}
      modules={result.program.modules.map((module) => ({
        title: module.title,
        lessonCount: module.lessons.length,
        isNew: true,
      }))}
    />
  );
}
