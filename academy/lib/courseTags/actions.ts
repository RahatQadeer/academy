"use server";

import { revalidatePath } from "next/cache";
import {
  archiveCourseTag,
  createCourseTag,
  loadCourseTags,
  restoreCourseTag,
  setProgramTags,
} from "./services";

export async function loadCourseTagsAction(includeArchived = false) {
  return loadCourseTags({ includeArchived, withCounts: includeArchived });
}

export async function createCourseTagAction(name: string) {
  const result = await createCourseTag(name);
  if (result.ok) {
    revalidatePath("/academy/admin/question-bank");
  }
  return result;
}

export async function archiveCourseTagAction(tagId: string) {
  const result = await archiveCourseTag(tagId);
  if (result.ok) {
    revalidatePath("/academy/admin/question-bank");
  }
  return result;
}

export async function restoreCourseTagAction(tagId: string) {
  const result = await restoreCourseTag(tagId);
  if (result.ok) {
    revalidatePath("/academy/admin/question-bank");
  }
  return result;
}

export async function setProgramTagsAction(programId: string, tagIds: string[]) {
  const result = await setProgramTags(programId, tagIds);
  if (result.ok) {
    revalidatePath(`/academy/admin/catalog/${programId}`);
    revalidatePath(`/academy/instructor/programs/${programId}`);
  }
  return result;
}
