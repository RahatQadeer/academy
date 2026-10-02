"use client";

import { CourseBuilder } from "@/academy/admin/catalog/components/CourseBuilder";
import { editorProgramToCatalog } from "../lib/toCatalogProgram";
import type { EditorProgram } from "../types";

export function ProgramEditor({ initial }: { initial: EditorProgram }) {
  return (
    <CourseBuilder
      program={editorProgramToCatalog(initial)}
      surface="instructor"
    />
  );
}
