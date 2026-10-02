import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type { AcademyCredentialStatus, AcademyEnrollmentStatus, AcademyProgramType } from "@/academy/lib/domain";
import { loadEnrollmentProgressHeadline } from "@/academy/lib/loadEnrollmentProgressHeadline";
import { isAcademyCredentialStatus } from "@/academy/credentials/utils/labels";
import type { LearningItem, MyLearningResult } from "../types";
import { MY_LEARNING_LIMIT, learningAction, sortLearningItems } from "../utils/learningState";

type ProgramEmbed = {
  id: string;
  name: string;
  type: AcademyProgramType;
  category: string | null;
  description: string | null;
  status: string;
};

type EnrollmentRow = {
  id: string;
  status: AcademyEnrollmentStatus;
  progress_percent: number;
  enrolled_at: string;
  completed_at: string | null;
  program_id: string;
  user_id: string;
  academy_programs: ProgramEmbed | ProgramEmbed[] | null;
};

type CredentialRow = {
  id: string;
  program_id: string;
  status: string;
};

function asProgram(value: EnrollmentRow["academy_programs"]): ProgramEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function credentialForProgram(
  credentials: CredentialRow[],
  programId: string,
): { id: string; status: AcademyCredentialStatus } | null {
  const row = credentials.find((item) => item.program_id === programId);
  if (!row || !isAcademyCredentialStatus(row.status)) return null;
  return { id: row.id, status: row.status };
}

export async function loadMyLearning(userId: string): Promise<MyLearningResult> {
  if (!userId) {
    return { ok: true, data: { items: [], truncated: false } };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("academy_enrollments")
      .select(
        "id, user_id, status, progress_percent, enrolled_at, completed_at, program_id, academy_programs ( id, name, type, category, description, status )",
      )
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false })
      .limit(MY_LEARNING_LIMIT + 1);

    if (error) return { ok: false };

    const rows = (data ?? []) as EnrollmentRow[];
    const truncated = rows.length > MY_LEARNING_LIMIT;
    const visible = rows.slice(0, MY_LEARNING_LIMIT);

    const { data: credentialRows } = await supabase
      .from("academy_credentials")
      .select("id, program_id, status")
      .eq("user_id", userId);

    let credentials = (credentialRows ?? []) as CredentialRow[];

    const completedWithoutCredential = visible.filter(
      (row) =>
        row.status === "completed" &&
        !credentials.some((item) => item.program_id === row.program_id),
    );

    if (completedWithoutCredential.length > 0) {
      await Promise.all(
        completedWithoutCredential.map((row) =>
          supabase.rpc("academy_ensure_completion_credential", { p_enrollment_id: row.id }),
        ),
      );

      const { data: refreshedCredentials } = await supabase
        .from("academy_credentials")
        .select("id, program_id, status")
        .eq("user_id", userId);

      credentials = (refreshedCredentials ?? []) as CredentialRow[];
    }

    const items: LearningItem[] = [];
    const headlineEntries = await Promise.all(
      visible.map(async (row) => {
        const program = asProgram(row.academy_programs);
        if (!program || row.status === "completed") {
          return { enrollmentId: row.id, headline: null as string | null };
        }
        const headline = await loadEnrollmentProgressHeadline(
          supabase,
          row.id,
          program.id,
          program.type,
        );
        return { enrollmentId: row.id, headline };
      }),
    );
    const headlines = new Map(headlineEntries.map((entry) => [entry.enrollmentId, entry.headline]));

    for (const row of visible) {
      if (row.user_id !== userId) continue;
      const program = asProgram(row.academy_programs);
      if (!program) continue;

      const credential = credentialForProgram(credentials, program.id);
      // Enrolled learners keep access after admin hides the program from Explore.
      const available = true;
      const progressHeadline = headlines.get(row.id) ?? null;

      items.push({
        enrollmentId: row.id,
        programId: program.id,
        programName: program.name,
        programType: program.type,
        category: program.category,
        description: program.description,
        status: row.status,
        progressPercent: row.progress_percent,
        enrolledAt: row.enrolled_at,
        completedAt: row.completed_at,
        progressHeadline,
        credentialId: credential?.id ?? null,
        credentialStatus: credential?.status ?? null,
        action: learningAction(row.status, program.id, row.progress_percent, credential, available),
        available,
      });
    }

    return { ok: true, data: { items: sortLearningItems(items), truncated } };
  } catch {
    return { ok: false };
  }
}
