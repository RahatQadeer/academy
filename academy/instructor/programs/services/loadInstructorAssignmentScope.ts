import "server-only";

import { createClient } from "@/base/lib/supabase/server";

export type InstructorAssignmentScope = {
  permissionLevel: "edit" | "create";
  moduleIds: string[];
  canPublishWithoutApproval: boolean;
};

export async function loadInstructorAssignmentScope(
  userId: string,
  programId: string,
): Promise<InstructorAssignmentScope | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_instructor_assignments")
    .select("permission_level, module_ids, can_publish_without_approval")
    .eq("user_id", userId)
    .eq("program_id", programId)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    permission_level?: string;
    module_ids?: string[] | null;
    can_publish_without_approval?: boolean;
  };
  const permissionLevel = row.permission_level === "create" ? "create" : "edit";
  const moduleIds = Array.isArray(row.module_ids)
    ? row.module_ids.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  return {
    permissionLevel,
    moduleIds,
    canPublishWithoutApproval: Boolean(row.can_publish_without_approval),
  };
}
