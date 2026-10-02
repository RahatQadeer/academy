import { GeneratingProgramRunner } from "./components/GeneratingProgramRunner";

export function CatalogGeneratingPage({
  prompt,
  length,
  difficulty,
  type,
  tagIds,
}: {
  prompt: string;
  length: string;
  difficulty: string;
  type: string;
  tagIds: string[];
}) {
  return (
    <GeneratingProgramRunner
      prompt={prompt}
      length={length}
      difficulty={difficulty}
      type={type}
      tagIds={tagIds}
    />
  );
}
