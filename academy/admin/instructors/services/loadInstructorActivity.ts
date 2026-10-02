import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import type { InstructorActivityItem } from "@/academy/admin/instructors/types";

function formatActivityLabel(status: string, programName: string | null): string {
  const program = programName ?? "a program";
  if (status === "pending") return `Submitted content for review — ${program}`;
  if (status === "approved") return `Approved a publish request for ${program}`;
  if (status === "rejected") return `Returned a publish request for ${program}`;
  return `Activity on ${program}`;
}

export async function loadInstructorActivity(
  userId: string,
): Promise<InstructorActivityItem[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("academy_publish_requests")
      .select("id, status, created_at, reviewed_at, program_id")
      .eq("submitted_by_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error || !data?.length) return [];

    const programIds = [...new Set(data.map((row) => row.program_id).filter(Boolean))];
    const names = new Map<string, string>();
    if (programIds.length > 0) {
      const { data: programs } = await supabase
        .from("academy_programs")
        .select("id, name")
        .in("id", programIds);
      for (const program of programs ?? []) {
        names.set(program.id, program.name);
      }
    }

    return data.map((row) => ({
      id: row.id,
      label: formatActivityLabel(row.status, names.get(row.program_id) ?? null),
      occurredAt: row.reviewed_at ?? row.created_at ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}
