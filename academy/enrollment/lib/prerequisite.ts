import "server-only";

import type { AcademyProgramType } from "@/academy/lib/domain";

type ProgramRow = {
  type?: AcademyProgramType;
  prerequisite_program_id: string | null;
};

/**
 * Prerequisites are not enforced for Explore enrollment.
 * The column remains for optional catalog notes; it never blocks Start/Purchase.
 */
export async function prerequisiteSatisfied(
  _supabase: Awaited<ReturnType<typeof import("@/base/lib/supabase/server").createClient>>,
  _userId: string,
  _program: ProgramRow,
): Promise<boolean> {
  return true;
}
