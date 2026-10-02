import { UUID } from "../../types";

export function normalizeAssignmentModuleIds(moduleIds: string[] | null | undefined): string[] {
  return [...new Set((moduleIds ?? []).map((id) => id.trim().toLowerCase()).filter((id) => UUID.test(id)))];
}
