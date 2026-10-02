"use server";

import { revalidatePath } from "next/cache";
import type {
  AdminUserSearchResult,
  GrantAcademyAdminResult,
  InviteAcademyAdminResult,
  RevokeAcademyAdminResult,
} from "./types";

function revalidateAdmins(userId?: string) {
  revalidatePath("/academy/admin");
  revalidatePath("/academy/admin/admins");
  revalidatePath("/academy/admin/users");
  revalidatePath("/academy/admin/instructors");
  revalidatePath("/academy/admin/approvals");
  if (userId) revalidatePath(`/academy/admin/instructors/${userId}`);
}

export async function searchUsersForAdminGrantAction(query: string): Promise<AdminUserSearchResult> {
  const { loadUsersForAdminGrant } = await import("./services/loadUsersForAdminGrant");
  return loadUsersForAdminGrant(query);
}

export async function grantAcademyAdminAction(userId: string): Promise<GrantAcademyAdminResult> {
  const { grantAcademyAdmin } = await import("./services/grantAcademyAdmin");
  const result = await grantAcademyAdmin(userId);
  if (result.ok) revalidateAdmins(result.userId);
  return result;
}

export async function inviteAcademyAdminAction(input: {
  email: string;
  displayName: string;
}): Promise<InviteAcademyAdminResult> {
  const { inviteAcademyAdmin } = await import("./services/inviteAcademyAdmin");
  const result = await inviteAcademyAdmin(input);
  if (result.ok) revalidateAdmins(result.userId ?? undefined);
  return result;
}

export async function resendAdminInviteAction(input: {
  email: string;
  displayName: string;
}): Promise<InviteAcademyAdminResult> {
  const { resendAdminInvite } = await import("./services/resendAdminInvite");
  const result = await resendAdminInvite(input);
  if (result.ok) revalidateAdmins();
  return result;
}

export async function revokeAcademyAdminAction(userId: string): Promise<RevokeAcademyAdminResult> {
  const { revokeAcademyAdmin } = await import("./services/revokeAcademyAdmin");
  const result = await revokeAcademyAdmin(userId);
  if (result.ok) revalidateAdmins(result.userId);
  return result;
}
