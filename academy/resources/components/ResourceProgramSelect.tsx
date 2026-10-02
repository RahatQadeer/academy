"use client";

import { useRouter } from "next/navigation";
import type { EnrolledProgramOption } from "../types";
import { resourcesHref } from "../utils/query";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

export function ResourceProgramSelect({
  programs,
  selectedProgramId,
}: {
  programs: EnrolledProgramOption[];
  selectedProgramId: string | null;
}) {
  const router = useRouter();

  if (programs.length === 0) return null;

  return (
    <FilterSelect
      label="Choose program"
      value={selectedProgramId ?? programs[0]?.programId ?? ""}
      onChange={(value) => router.push(resourcesHref({ programId: value }))}
      options={programs.map((program) => ({
        value: program.programId,
        label: program.programName,
      }))}
    />
  );
}
