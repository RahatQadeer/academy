import "server-only";

import { getSessionProfile } from "@/base/identity/session";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  isAcademyAdmin,
  isInstructor,
} from "@/academy/lib/authorization";
import { parseCourseAttachmentFile, type ParseCourseAttachmentResult } from "@/academy/admin/lib/parseCourseAttachment";

export async function parseCourseGenAttachment(formData: FormData): Promise<ParseCourseAttachmentResult> {
  const profile = await getSessionProfile();
  if (!profile) {
    return { ok: false, error: "Sign in to attach a file." };
  }

  const actor = { id: profile.user.id };
  const [adminArea, admin, instructorArea, instructor] = await Promise.all([
    canAccessAdminArea(actor),
    isAcademyAdmin(actor),
    canAccessInstructorArea(actor),
    isInstructor(actor),
  ]);

  if (!((adminArea && admin) || (instructorArea && instructor))) {
    return { ok: false, error: "You do not have permission to attach files for course generation." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file was uploaded." };
  }

  return parseCourseAttachmentFile(file);
}
