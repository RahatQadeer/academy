import "server-only";

import { publishProgram as publishApprovedAcademyProgram } from "@/academy/publish/services/publishProgram";

export async function publishProgram(programId: string) {
  return publishApprovedAcademyProgram(programId);
}
