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
import type { ExploreProgramDetailResult } from "../types";
import { resolveAcademyAssetUrl } from "@/academy/lib/resolveAcademyAssetUrl";
import { learnerCanAccessProgramContent } from "@/academy/lib/learnerProgramAccess";
import { resolveProgramAccess } from "../utils/accessState";
import { loadPendingCheckoutId } from "@/academy/enrollment/services/loadPendingCheckouts";

const PROGRAM_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
};

type EnrollmentRow = {
  status: AcademyEnrollmentStatus;
  progress_percent: number;
  entitlement_source: AcademyEntitlementSource | null;
};

type CredentialRow = {
  program_id: string;
  type: string;
  status: string;
};

type ModuleRow = {
  id: string;
  title: string;
  sort_order: number;
};

export async function loadProgramDetail(
  userId: string,
  programId: string,
): Promise<ExploreProgramDetailResult> {
  if (!userId || !PROGRAM_ID.test(programId)) {
    return { ok: true, data: null };
  }

  try {
    const supabase = await createClient();

    const { data: program, error: programError } = await supabase
      .from("academy_programs")
      .select(
        "id, name, type, access, recognition, learning_path, category, description, cover_image_url, price, prerequisite_program_id, status",
      )
      .eq("id", programId)
      .maybeSingle();

    if (programError) return { ok: false };
    if (!program) return { ok: true, data: null };

    const raw = program as ProgramRow & { status: string };
    const courseType = normalizeLegacyProgramType(raw.type) as AcademyProgramType;
    const accessMode = coerceAccess(raw.access, courseType) as AcademyCourseAccess;
    const recognition = coerceRecognitionForType(courseType, raw.recognition) as AcademyCourseRecognition;
    const learningPath = coerceLearningPath(raw.learning_path, courseType) as AcademyLearningPath;
    const row = { ...raw, type: courseType };

    const { data: enrollment } = await supabase
      .from("academy_enrollments")
      .select("status, progress_percent, entitlement_source")
      .eq("user_id", userId)
      .eq("program_id", programId)
      .maybeSingle();

    const enrollmentRowEarly = (enrollment ?? null) as EnrollmentRow | null;
    // Hidden programs stay reachable for learners who already enrolled.
    if (row.status !== "published" && !enrollmentRowEarly) {
      return { ok: true, data: null };
    }

    const [
      { data: credentials },
      { data: prerequisite },
      { data: modules },
      { data: prereqEnrollment },
      { data: nextRows },
      { data: relatedRows },
    ] = await Promise.all([
      supabase
        .from("academy_credentials")
        .select("program_id, type, status")
        .eq("user_id", userId),
      row.prerequisite_program_id
        ? supabase
            .from("academy_programs")
            .select("id, name")
            .eq("id", row.prerequisite_program_id)
            .eq("status", "published")
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("academy_modules")
        .select("id, title, sort_order")
        .eq("program_id", programId)
        .order("sort_order", { ascending: true })
        .limit(20),
      row.prerequisite_program_id
        ? supabase
            .from("academy_enrollments")
            .select("status")
            .eq("user_id", userId)
            .eq("program_id", row.prerequisite_program_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("academy_programs")
        .select("id, name, type")
        .eq("status", "published")
        .eq("prerequisite_program_id", programId)
        .neq("id", programId)
        .order("name", { ascending: true })
        .limit(4),
      supabase
        .from("academy_programs")
        .select("id, name, type")
        .eq("status", "published")
        .eq("type", row.type)
        .neq("id", programId)
        .order("name", { ascending: true })
        .limit(6),
    ]);

    const credentialRows = (credentials ?? []) as CredentialRow[];
    const awardedProgramIds = new Set(
      credentialRows.filter((item) => item.status === "awarded").map((item) => item.program_id),
    );

    let prerequisiteMet = true;
    if (row.prerequisite_program_id) {
      prerequisiteMet =
        (prereqEnrollment as { status?: AcademyEnrollmentStatus } | null)?.status === "completed" ||
        awardedProgramIds.has(row.prerequisite_program_id);
    }

    const enrollmentRow = enrollmentRowEarly;
    const contentUnlocked = learnerCanAccessProgramContent({
      price: row.price,
      entitlementSource: enrollmentRow?.entitlement_source ?? null,
      enrolled: Boolean(enrollmentRow),
      access: accessMode,
    });

    const coverImageUrl = await resolveAcademyAssetUrl(supabase, row.cover_image_url);
    const pendingCheckoutId =
      enrollmentRow && contentUnlocked ? null : await loadPendingCheckoutId(userId, programId);

    const moduleRows = contentUnlocked ? ((modules ?? []) as ModuleRow[]) : [];
    const { count: moduleCount } = contentUnlocked
      ? { count: moduleRows.length }
      : await supabase
          .from("academy_modules")
          .select("id", { count: "exact", head: true })
          .eq("program_id", programId);

    return {
      ok: true,
      data: {
        id: row.id,
        name: row.name,
        type: courseType,
        accessMode,
        recognition,
        learningPath,
        category: row.category,
        description: row.description,
        coverImageUrl,
        price: row.price,
        prerequisiteProgramId: row.prerequisite_program_id,
        prerequisiteName: (prerequisite as { name?: string } | null)?.name ?? null,
        enrollmentStatus: enrollmentRow?.status ?? null,
        progressPercent: enrollmentRow?.progress_percent ?? null,
        contentUnlocked,
        moduleCount: moduleCount ?? moduleRows.length,
        access: resolveProgramAccess({
          programId: row.id,
          type: courseType,
          access: accessMode,
          price: row.price,
          enrollmentStatus: enrollmentRow?.status ?? null,
          entitlementSource: enrollmentRow?.entitlement_source ?? null,
          prerequisiteMet,
          prerequisiteName: (prerequisite as { name?: string } | null)?.name ?? null,
          pendingCheckoutId,
        }),
        modules: moduleRows.map((module) => ({
          id: module.id,
          title: module.title,
          sortOrder: module.sort_order,
        })),
        nextCourses: ((nextRows ?? []) as { id: string; name: string; type: string }[]).map(
          (item) => ({
            id: item.id,
            name: item.name,
            type: normalizeLegacyProgramType(item.type) as AcademyProgramType,
          }),
        ),
        relatedCourses: ((relatedRows ?? []) as { id: string; name: string; type: string }[])
          .filter((item) => !(nextRows ?? []).some((next) => (next as { id: string }).id === item.id))
          .slice(0, 4)
          .map((item) => ({
            id: item.id,
            name: item.name,
            type: normalizeLegacyProgramType(item.type) as AcademyProgramType,
          })),
      },
    };
  } catch {
    return { ok: false };
  }
}
