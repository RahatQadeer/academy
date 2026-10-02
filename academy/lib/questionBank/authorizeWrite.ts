import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  canAuthorProgram,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import type { AcademyProgramStatus } from "@/academy/lib/domain";
import { PROGRAM_ID } from "@/academy/lesson-player/utils/curriculum";

type ProgramRow = { id: string; name: string; status: AcademyProgramStatus };
type LessonRow = { id: string; module_id: string; title: string; type: string };
type ModuleRow = { id: string; program_id: string };

export type BankWriteContext = {
  isAdmin: boolean;
  supabase: Awaited<ReturnType<typeof createClient>>;
  program: ProgramRow;
  lesson: LessonRow;
};

export type BankProgramContext = {
  isAdmin: boolean;
  supabase: Awaited<ReturnType<typeof createClient>>;
  program: ProgramRow;
};

async function loadAuthorSession(programId: string): Promise<
  | {
      ok: true;
      isAdmin: boolean;
      supabase: Awaited<ReturnType<typeof createClient>>;
      program: ProgramRow;
    }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "published" | "failed";
      message: string;
    }
> {
  if (!PROGRAM_ID.test(programId)) {
    return { ok: false, reason: "invalid", message: "Choose a course." };
  }

  const profile = await getSessionProfile();
  if (!profile) return { ok: false, reason: "unauthorized", message: "Sign in required." };

  const actor = { id: profile.user.id };
  const [adminArea, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
  const isAdmin = adminArea && admin;

  if (!isAdmin) {
    const [instructorArea, instructor, allowed] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
      canAuthorProgram(actor, programId),
    ]);
    const isAssignedInstructor = instructorArea && instructor && allowed;
    if (!isAssignedInstructor) {
      return { ok: false, reason: "unauthorized", message: "You cannot edit this course." };
    }
  }

  const supabase = await createClient();
  const { data: program, error: programError } = await supabase
    .from("academy_programs")
    .select("id, name, status")
    .eq("id", programId)
    .maybeSingle();
  if (programError || !program) {
    return { ok: false, reason: "failed", message: "The course could not be loaded." };
  }

  const programRow = program as ProgramRow;
  if (!isAdmin && programRow.status === "published") {
    return {
      ok: false,
      reason: "published",
      message: "Live courses cannot be edited here. Ask an admin, or wait until the course is unpublished.",
    };
  }

  return { ok: true, isAdmin, supabase, program: programRow };
}

export async function authorizeBankProgram(
  programIdRaw: string,
): Promise<
  | { ok: true; ctx: BankProgramContext }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "published" | "failed";
      message: string;
    }
> {
  const programId = programIdRaw.trim().toLowerCase();
  try {
    const access = await loadAuthorSession(programId);
    if (!access.ok) return access;
    return { ok: true, ctx: { isAdmin: access.isAdmin, supabase: access.supabase, program: access.program } };
  } catch {
    return { ok: false, reason: "failed", message: "The course could not be loaded. Try again." };
  }
}

export async function authorizeBankWrite(
  programIdRaw: string,
  lessonIdRaw: string,
): Promise<
  | { ok: true; ctx: BankWriteContext }
  | {
      ok: false;
      reason: "unauthorized" | "invalid" | "published" | "failed";
      message: string;
    }
> {
  const programId = programIdRaw.trim().toLowerCase();
  const lessonId = lessonIdRaw.trim().toLowerCase();
  if (!PROGRAM_ID.test(lessonId)) {
    return { ok: false, reason: "invalid", message: "Choose a course and a lesson." };
  }

  try {
    const access = await loadAuthorSession(programId);
    if (!access.ok) return access;

    const { supabase } = access;
    const { data: lesson, error: lessonError } = await supabase
      .from("academy_lessons")
      .select("id, module_id, title, type")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonError) return { ok: false, reason: "failed", message: "The lesson could not be loaded." };

    const lessonRow = lesson as LessonRow | null;
    if (!lessonRow) {
      return { ok: false, reason: "invalid", message: "That lesson could not be found." };
    }

    const { data: moduleRowData, error: moduleError } = await supabase
      .from("academy_modules")
      .select("id, program_id")
      .eq("id", lessonRow.module_id)
      .maybeSingle();
    if (moduleError) return { ok: false, reason: "failed", message: "The lesson could not be loaded." };

    const moduleRow = moduleRowData as ModuleRow | null;
    if (!moduleRow || moduleRow.program_id !== programId) {
      return { ok: false, reason: "invalid", message: "That lesson does not belong to the selected course." };
    }

    return {
      ok: true,
      ctx: { isAdmin: access.isAdmin, supabase, program: access.program, lesson: lessonRow },
    };
  } catch {
    return { ok: false, reason: "failed", message: "The course could not be loaded. Try again." };
  }
}
