"use server";

import { revalidatePath } from "next/cache";
import type { AcademyAdminSettings, SaveAcademySettingsResult } from "./types";

export async function saveAcademySettingsAction(
  input: AcademyAdminSettings,
): Promise<SaveAcademySettingsResult> {
  const { saveAcademySettings } = await import("./services/saveAcademySettings");
  const result = await saveAcademySettings(input);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/settings");
    revalidatePath("/academy/admin/catalog/new");
  }
  return result;
}
