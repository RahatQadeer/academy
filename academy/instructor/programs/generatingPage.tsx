import { GeneratingProgramRunner } from "@/academy/admin/catalog/components/GeneratingProgramRunner";

export function InstructorGeneratingPage({
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
      surface="instructor"
      prompt={prompt}
      length={length}
      difficulty={difficulty}
      type={type}
      tagIds={tagIds}
    />
  );
}
