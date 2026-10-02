import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type {
  AcademyCourseAccess,
  AcademyCourseRecognition,
  AcademyEnrollmentStatus,
  AcademyEntitlementSource,
  AcademyLearningPath,
  AcademyProgramType,
} from "@/academy/lib/domain";
import {
  coerceAccess,
  coerceLearningPath,
  coerceRecognitionForType,
  normalizeLegacyProgramType,
} from "@/academy/lib/courseMetadata";
import { resolveAcademyAssetUrl } from "@/academy/lib/resolveAcademyAssetUrl";
import type { ExploreCatalogQuery, ExploreCatalogResult, ExploreProgramCard } from "../types";
import { resolveProgramAccess } from "../utils/accessState";
import { sortCatalogPrograms } from "../utils/catalogSequence";
import { aggregateProgramSkills } from "../utils/programSkills";
import { loadPendingCheckoutIdsByProgram } from "@/academy/enrollment/services/loadPendingCheckouts";

/** Full published set for client-side chip filters (type / access / sort). */
const EXPLORE_CATALOG_LIMIT = 120;

type ProgramRow = {
  id: string;
  name: string;
  type: string;
  access: string | null;
  recognition: string | null;
  learning_path: string | null;
  category: string | null;
  description: string | null;
  cover_image_url: string | null;
  price: number | null;
  prerequisite_program_id: string | null;
  created_at: string | null;
};

type EnrollmentRow = {
  program_id: string;
  status: AcademyEnrollmentStatus;
  entitlement_source: AcademyEntitlementSource | null;
};

type CredentialRow = {
  program_id: string;
  type: string;
  status: string;
};

function prerequisiteMet(input: {
  program: ProgramRow;
  enrollmentByProgram: Map<string, AcademyEnrollmentStatus>;
  awardedProgramIds: Set<string>;
}): boolean {
  const prerequisiteId = input.program.prerequisite_program_id;
  if (!prerequisiteId) return true;
  return (
    input.enrollmentByProgram.get(prerequisiteId) === "completed" ||
    input.awardedProgramIds.has(prerequisiteId)
  );
}

export async function loadExploreCatalog(
  userId: string,
  query: ExploreCatalogQuery,
): Promise<ExploreCatalogResult> {
  if (!userId) {
    return { ok: true, data: { programs: [], query, truncated: false } };
  }

  try {
    const supabase = await createClient();
    const fetchLimit = EXPLORE_CATALOG_LIMIT + 1;

    // Always load the full published slice — type/access/sort filter on the client.
    const { data: programRows, error: programError } = await supabase
      .from("academy_programs")
      .select(
        "id, name, type, access, recognition, learning_path, category, description, cover_image_url, price, prerequisite_program_id, created_at",
      )
      .eq("status", "published")
      .limit(fetchLimit);

    if (programError) return { ok: false };

    const normalized = ((programRows ?? []) as ProgramRow[]).map((row) => {
      const type = normalizeLegacyProgramType(row.type) as AcademyProgramType;
      return {
        ...row,
        type,
        accessMode: coerceAccess(row.access, type) as AcademyCourseAccess,
        recognition: coerceRecognitionForType(type, row.recognition) as AcademyCourseRecognition,
        learningPath: coerceLearningPath(row.learning_path, type) as AcademyLearningPath,
      };
    });

    const matched = sortCatalogPrograms(normalized, "sequence");
    const truncated = matched.length > EXPLORE_CATALOG_LIMIT;
    const visible = matched.slice(0, EXPLORE_CATALOG_LIMIT);
    const programIds = visible.map((row) => row.id);
    const prerequisiteIds = [
      ...new Set(
        visible
          .map((row) => row.prerequisite_program_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const enrollmentProgramIds = [...new Set([...programIds, ...prerequisiteIds])];

    const [
      { data: enrollmentRows, error: enrollmentError },
      { data: credentialRows },
      { data: prerequisiteRows },
      { data: moduleRows },
    ] = await Promise.all([
      enrollmentProgramIds.length
        ? supabase
            .from("academy_enrollments")
            .select("program_id, status, entitlement_source")
            .eq("user_id", userId)
            .in("program_id", enrollmentProgramIds)
        : Promise.resolve({ data: [] as EnrollmentRow[], error: null }),
      supabase
        .from("academy_credentials")
        .select("program_id, type, status")
        .eq("user_id", userId),
      prerequisiteIds.length
        ? supabase
            .from("academy_programs")
            .select("id, name")
            .eq("status", "published")
            .in("id", prerequisiteIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      programIds.length
        ? supabase.from("academy_modules").select("program_id").in("program_id", programIds)
        : Promise.resolve({ data: [] as { program_id: string }[] }),
    ]);

    if (enrollmentError) return { ok: false };

    const pendingCheckoutByProgram = await loadPendingCheckoutIdsByProgram(userId, programIds);

    const enrollmentByProgram = new Map<string, AcademyEnrollmentStatus>();
    const entitlementByProgram = new Map<string, AcademyEntitlementSource | null>();
    for (const row of (enrollmentRows ?? []) as EnrollmentRow[]) {
      enrollmentByProgram.set(row.program_id, row.status);
      entitlementByProgram.set(row.program_id, row.entitlement_source);
    }

    const credentials = (credentialRows ?? []) as CredentialRow[];
    const awardedProgramIds = new Set(
      credentials.filter((row) => row.status === "awarded").map((row) => row.program_id),
    );

    const prerequisiteNameById = new Map(
      ((prerequisiteRows ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]),
    );

    const moduleCountByProgram = new Map<string, number>();
    for (const row of (moduleRows ?? []) as { program_id: string }[]) {
      moduleCountByProgram.set(row.program_id, (moduleCountByProgram.get(row.program_id) ?? 0) + 1);
    }

    const coverUrls = await Promise.all(
      visible.map((program) => resolveAcademyAssetUrl(supabase, program.cover_image_url)),
    );

    const programs: ExploreProgramCard[] = visible.map((program, index) => {
      const enrollmentStatus = enrollmentByProgram.get(program.id) ?? null;
      return {
        id: program.id,
        name: program.name,
        type: program.type,
        accessMode: program.accessMode,
        recognition: program.recognition,
        learningPath: program.learningPath,
        category: program.category,
        description: program.description,
        coverImageUrl: coverUrls[index] ?? null,
        price: program.price,
        createdAt: program.created_at,
        prerequisiteProgramId: program.prerequisite_program_id,
        prerequisiteName: program.prerequisite_program_id
          ? (prerequisiteNameById.get(program.prerequisite_program_id) ?? null)
          : null,
        enrollmentStatus,
        access: resolveProgramAccess({
          programId: program.id,
          type: program.type,
          access: program.accessMode,
          price: program.price,
          enrollmentStatus,
          entitlementSource: entitlementByProgram.get(program.id) ?? null,
          prerequisiteMet: prerequisiteMet({
            program,
            enrollmentByProgram,
            awardedProgramIds,
          }),
          prerequisiteName: program.prerequisite_program_id
            ? (prerequisiteNameById.get(program.prerequisite_program_id) ?? null)
            : null,
          pendingCheckoutId: pendingCheckoutByProgram.get(program.id) ?? null,
        }),
        moduleCount: moduleCountByProgram.get(program.id) ?? 0,
        skillsGained: aggregateProgramSkills({
          lessonObjectives: [],
          category: program.category,
        }),
      };
    });

    return { ok: true, data: { programs, query, truncated } };
  } catch {
    return { ok: false };
  }
}
