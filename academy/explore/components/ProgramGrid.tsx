import type { ExploreProgramCard } from "../types";
import { ProgramCard } from "./ProgramCard";

export function ProgramGrid({ programs }: { programs: ExploreProgramCard[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
      {programs.map((program) => (
        <ProgramCard key={program.id} program={program} />
      ))}
    </div>
  );
}
