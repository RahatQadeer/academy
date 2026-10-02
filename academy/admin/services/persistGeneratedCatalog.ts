import "server-only";

import type { createClient } from "@/base/lib/supabase/server";
import {
  DEFAULT_ACCESS_BY_TYPE,
  DEFAULT_LEARNING_PATH_BY_TYPE,
  DEFAULT_RECOGNITION_BY_TYPE,
  DEFAULT_VALIDITY_BY_RECOGNITION,
  mapLegacyProgramType,
  toDbProgramType,
} from "@/academy/lib/courseMetadata";
import { lessonNeedsTeachingBody } from "@/academy/admin/lib/courseAttachmentText";
import { rewriteProgramDraft, type PersistedProgramDraft } from "./catalogPersistence";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function persistGeneratedCatalog({
  supabase,
  userId,
  surface,
  draft,
  prompt,
  requestType,
  access: accessOverride,
}: {
  supabase: Supabase;
  userId: string;
  surface: "admin" | "instructor";
  draft: PersistedProgramDraft;
  prompt: string;
  requestType: string;
  /** Whitby Free/Paid selection — overrides DEFAULT_ACCESS_BY_TYPE. */
  access?: "free" | "purchased";
}): Promise<{ ok: true; programId: string } | { ok: false; message: string }> {
  const name = (draft.name.trim() || "Untitled program").slice(0, 120);
  const description = (draft.description || prompt).trim().slice(0, 4000);
  // Always coerce — never write legacy values like paid_course / free_course / cpa.
  const type = toDbProgramType(draft.type || requestType);
  const mapped =
    mapLegacyProgramType(draft.type) ??
    mapLegacyProgramType(requestType) ??
    mapLegacyProgramType(type);
  const access = accessOverride ?? mapped?.access ?? DEFAULT_ACCESS_BY_TYPE[type];
  const recognition = mapped?.recognition ?? DEFAULT_RECOGNITION_BY_TYPE[type];
  const learningPath = mapped?.learningPath ?? DEFAULT_LEARNING_PATH_BY_TYPE[type];
  const credentialValidity = DEFAULT_VALIDITY_BY_RECOGNITION[recognition];
  // Category is free text — store a human label, not a legacy enum slug.
  const categoryLabel =
    type === "short_course"
      ? "Short Course"
      : type === "certification_program"
        ? "Certification Program"
        : type === "endorsement_program"
          ? "Specialty Endorsement"
          : "Course";
  const category = (draft.category || categoryLabel).trim().slice(0, 80);

  const incomplete = draft.modules.flatMap((module) =>
    module.lessons.filter((lesson) => {
      if (lessonNeedsTeachingBody(lesson.type, lesson.contentBody)) return true;
      if (lesson.type === "assignment" && !lesson.assignment?.brief?.trim()) return true;
      return false;
    }),
  );
  if (incomplete.length) {
    return {
      ok: false,
      message: `Whitby could not finish every lesson body (${incomplete
        .slice(0, 3)
        .map((lesson) => lesson.title)
        .join(", ")}). Incomplete courses are not saved — generate again.`,
    };
  }

  let programId: string | null = null;

  if (surface === "instructor") {
    const { data, error } = await supabase.rpc("academy_instructor_create_program", {
      p_name: name,
      p_type: type,
      p_category: category || null,
      p_description: description || null,
      p_prerequisite_program_id: null,
      p_price: null,
    });
    if (error || typeof data !== "string") {
      console.error("[persistGeneratedCatalog] instructor create", error);
      return { ok: false, message: error?.message ?? "The program draft could not be created." };
    }
    programId = data;
  } else {
    const { data, error } = await supabase
      .from("academy_programs")
      .insert({
        name,
        type,
        access,
        recognition,
        learning_path: learningPath,
        credential_validity: credentialValidity,
        category: category || categoryLabel,
        description: description || prompt,
        status: "draft",
        created_by_user_id: userId,
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      console.error("[persistGeneratedCatalog] admin insert", error);
      return { ok: false, message: error?.message ?? "The program draft could not be created." };
    }
    programId = (data as { id: string }).id;
  }

  // Instructor RPC sets access from type defaults — apply Whitby Free/Paid when provided.
  if (surface === "instructor" && accessOverride) {
    const { error: accessError } = await supabase
      .from("academy_programs")
      .update({ access: accessOverride })
      .eq("id", programId);
    if (accessError) {
      console.error("[persistGeneratedCatalog] instructor access", accessError);
    }
  }

  const persisted = await rewriteProgramDraft(supabase, programId, { ...draft, name, type, category, description });
  if (!persisted.ok) {
    console.error("[persistGeneratedCatalog] rewrite failed", programId);
    return {
      ok: false,
      message:
        "The course was generated but could not be saved. Apply the latest Academy migrations, then try again.",
    };
  }

  return { ok: true, programId };
}
