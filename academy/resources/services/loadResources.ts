import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type { AcademyEntitlementSource } from "@/academy/lib/domain";
import { learnerCanAccessProgramContent } from "@/academy/lib/learnerProgramAccess";
import type {
  EnrolledProgramOption,
  LearnerResourceItem,
  ResourcesLoadResult,
  ResourcesQuery,
} from "../types";
import { ENROLLED_PROGRAM_LIMIT, RESOURCE_LIMIT } from "../types";

type ProgramEmbed = {
  id: string;
  name: string;
  status?: string;
  price?: number | null;
  access?: string | null;
};

type EnrollmentRow = {
  user_id: string;
  program_id: string;
  enrolled_at: string;
  entitlement_source: AcademyEntitlementSource | null;
  academy_programs: ProgramEmbed | ProgramEmbed[] | null;
};

type ResourceRow = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: string;
  url: string;
  notes: string | null;
  sort_order: number;
};

function asProgram(value: EnrollmentRow["academy_programs"]): ProgramEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toOption(row: EnrollmentRow, userId: string): EnrolledProgramOption | null {
  if (row.user_id !== userId) return null;
  const program = asProgram(row.academy_programs);
  if (!program || program.status !== "published") return null;
  if (
    !learnerCanAccessProgramContent({
      price: program.price ?? null,
      entitlementSource: row.entitlement_source,
      enrolled: true,
      access: program.access,
    })
  ) {
    return null;
  }
  return { programId: program.id, programName: program.name };
}

function sortResources(items: LearnerResourceItem[], sort: ResourcesQuery["sort"]) {
  const copy = [...items];
  if (sort === "type") {
    copy.sort(
      (a, b) =>
        a.resourceType.localeCompare(b.resourceType) || a.title.localeCompare(b.title),
    );
  } else if (sort === "lesson") {
    copy.sort(
      (a, b) =>
        a.lessonTitle.localeCompare(b.lessonTitle) ||
        a.moduleTitle.localeCompare(b.moduleTitle) ||
        a.sortOrder - b.sortOrder,
    );
  } else {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy;
}

export async function loadResources(
  userId: string,
  query: ResourcesQuery,
): Promise<ResourcesLoadResult> {
  if (!userId) {
    return {
      ok: true,
      data: {
        enrolledPrograms: [],
        selectedProgramId: null,
        selectedProgramName: null,
        truncatedEnrollments: false,
        resources: [],
        resourceTypes: [],
      },
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_enrollments")
      .select(
        "user_id, program_id, enrolled_at, entitlement_source, academy_programs ( id, name, status, price, access )",
      )
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false })
      .limit(ENROLLED_PROGRAM_LIMIT + 1);

    if (error) return { ok: false };

    const rows = (data ?? []) as EnrollmentRow[];
    const truncatedEnrollments = rows.length > ENROLLED_PROGRAM_LIMIT;
    const enrolledPrograms: EnrolledProgramOption[] = [];
    const seen = new Set<string>();

    for (const row of rows.slice(0, ENROLLED_PROGRAM_LIMIT)) {
      const option = toOption(row, userId);
      if (!option || seen.has(option.programId)) continue;
      seen.add(option.programId);
      enrolledPrograms.push(option);
    }

    let selected =
      query.programId && seen.has(query.programId)
        ? enrolledPrograms.find((item) => item.programId === query.programId) ?? null
        : null;

    if (!selected && query.programId) {
      const { data: extra, error: extraError } = await supabase
        .from("academy_enrollments")
        .select(
        "user_id, program_id, enrolled_at, entitlement_source, academy_programs ( id, name, status, price, access )",
      )
        .eq("user_id", userId)
        .eq("program_id", query.programId)
        .maybeSingle();

      if (extraError) return { ok: false };

      const option = extra ? toOption(extra as EnrollmentRow, userId) : null;
      if (option) {
        enrolledPrograms.unshift(option);
        seen.add(option.programId);
        selected = option;
      }
    }

    if (!selected) selected = enrolledPrograms[0] ?? null;

    let resources: LearnerResourceItem[] = [];
    if (selected) {
      const { data: modules } = await supabase
        .from("academy_modules")
        .select("id, title, sort_order")
        .eq("program_id", selected.programId)
        .order("sort_order", { ascending: true });

      const moduleRows = (modules ?? []) as { id: string; title: string; sort_order: number }[];
      const moduleById = new Map(moduleRows.map((row) => [row.id, row]));
      const moduleIds = moduleRows.map((row) => row.id);

      const { data: lessons } =
        moduleIds.length > 0
          ? await supabase
              .from("academy_lessons")
              .select("id, title, module_id, sort_order")
              .in("module_id", moduleIds)
          : { data: [] as { id: string; title: string; module_id: string; sort_order: number }[] };

      const lessonRows = (lessons ?? []) as { id: string; title: string; module_id: string; sort_order: number }[];
      const lessonById = new Map(lessonRows.map((row) => [row.id, row]));
      const lessonIds = lessonRows.map((row) => row.id);

      const { data: resourceRows } =
        lessonIds.length > 0
          ? await supabase
              .from("academy_lesson_resources")
              .select("id, lesson_id, title, resource_type, url, notes, sort_order")
              .in("lesson_id", lessonIds)
              .limit(RESOURCE_LIMIT)
          : { data: [] as ResourceRow[] };

      resources = ((resourceRows ?? []) as ResourceRow[])
        .map((row) => {
          const lesson = lessonById.get(row.lesson_id);
          const module = lesson ? moduleById.get(lesson.module_id) : undefined;
          if (!lesson || !module) return null;
          return {
            id: row.id,
            title: row.title,
            resourceType: row.resource_type,
            url: row.url,
            notes: row.notes ?? "",
            programId: selected!.programId,
            programName: selected!.programName,
            moduleTitle: module.title,
            lessonTitle: lesson.title,
            sortOrder: row.sort_order,
          } satisfies LearnerResourceItem;
        })
        .filter((item): item is LearnerResourceItem => Boolean(item));
    }

    const allResources = resources;
    const resourceTypes = [...new Set(allResources.map((item) => item.resourceType))].sort();

    const search = query.search.toLowerCase();
    resources = allResources.filter((item) => {
      if (query.type && item.resourceType !== query.type) return false;
      if (
        search &&
        !item.title.toLowerCase().includes(search) &&
        !item.notes.toLowerCase().includes(search) &&
        !item.lessonTitle.toLowerCase().includes(search) &&
        !item.resourceType.toLowerCase().includes(search)
      ) {
        return false;
      }
      return true;
    });

    resources = sortResources(resources, query.sort);

    return {
      ok: true,
      data: {
        enrolledPrograms,
        selectedProgramId: selected?.programId ?? null,
        selectedProgramName: selected?.programName ?? null,
        truncatedEnrollments,
        resources,
        resourceTypes,
      },
    };
  } catch {
    return { ok: false };
  }
}
