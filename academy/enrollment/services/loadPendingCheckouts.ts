import "server-only";

import { createClient } from "@/base/lib/supabase/server";

export async function loadPendingCheckoutIdsByProgram(
  userId: string,
  programIds: string[],
): Promise<Map<string, string>> {
  if (!userId || programIds.length === 0) {
    return new Map();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_checkout_sessions")
    .select("id, program_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .in("program_id", programIds);

  const map = new Map<string, string>();
  for (const row of (data ?? []) as { id: string; program_id: string }[]) {
    map.set(row.program_id, row.id);
  }
  return map;
}

export async function loadPendingCheckoutId(
  userId: string,
  programId: string,
): Promise<string | null> {
  const map = await loadPendingCheckoutIdsByProgram(userId, [programId]);
  return map.get(programId) ?? null;
}
