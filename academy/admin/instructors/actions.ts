"use server";

import { revalidatePath } from "next/cache";
import type {
  AssignInstructorInput,
  AssignInstructorResult,
  GrantInstructorResult,
  GrantInstructorWithAssignmentsInput,
  GrantInstructorWithAssignmentsResult,
  InviteInstructorResult,
  RevokeAssignmentResult,
  RevokeInstructorRoleResult,
  UpdateInstructorAssignmentInput,
  UpdateInstructorAssignmentResult,
  UserSearchResult,
} from "./types";
import type { RevokeAcademyLearnerResult } from "./services/revokeAcademyLearnerRole";

function revalidateInstructorRole(userId: string) {
  revalidatePath("/academy/admin");
  revalidatePath("/academy/admin/instructors");
  revalidatePath(`/academy/admin/instructors/${userId}`);
  revalidatePath("/academy/instructor");
  revalidatePath("/academy/instructor/programs");
}

export async function revokeAcademyLearnerRoleAction(
  userId: string,
): Promise<RevokeAcademyLearnerResult> {
  const { revokeAcademyLearnerRole } = await import("./services/revokeAcademyLearnerRole");
  const result = await revokeAcademyLearnerRole(userId);
  if (result.ok) revalidateInstructorRole(result.userId);
  return result;
}

export async function assignInstructorAction(
  input: AssignInstructorInput,
): Promise<AssignInstructorResult> {
  const { assignInstructor } = await import("./services/assignInstructor");
  const result = await assignInstructor(input);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/instructors");
    revalidatePath(`/academy/admin/instructors/${input.userId}`);
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${input.programId}`);
  }
  return result;
}

export async function revokeInstructorAssignmentAction(
  assignmentId: string,
): Promise<RevokeAssignmentResult> {
  const { revokeInstructorAssignment } = await import("./services/revokeInstructorAssignment");
  const result = await revokeInstructorAssignment(assignmentId);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/instructors");
    revalidatePath(`/academy/admin/instructors/${result.userId}`);
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${result.programId}`);
  }
  return result;
}

export async function updateInstructorAssignmentAction(
  input: UpdateInstructorAssignmentInput,
): Promise<UpdateInstructorAssignmentResult> {
  const { updateInstructorAssignment } = await import("./services/updateInstructorAssignment");
  const result = await updateInstructorAssignment(input);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/instructors");
    revalidatePath(`/academy/admin/instructors/${result.userId}`);
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
    revalidatePath(`/academy/instructor/programs/${result.programId}`);
  }
  return result;
}

export async function searchUsersForInstructorGrantAction(query: string): Promise<UserSearchResult> {
  const { loadUsersForInstructorGrant } = await import("./services/loadUsersForInstructorGrant");
  return loadUsersForInstructorGrant(query);
}

export async function loadProgramModulesAction(programId: string) {
  const { loadProgramModules } = await import("./services/loadProgramModules");
  return loadProgramModules(programId);
}

export async function grantInstructorRoleAction(userId: string): Promise<GrantInstructorResult> {
  const { grantInstructorRole } = await import("./services/grantInstructorRole");
  const result = await grantInstructorRole(userId);
  if (result.ok) revalidateInstructorRole(result.userId);
  return result;
}

export async function revokeInstructorRoleAction(userId: string): Promise<RevokeInstructorRoleResult> {
  const { revokeInstructorRole } = await import("./services/revokeInstructorRole");
  const result = await revokeInstructorRole(userId);
  if (result.ok) revalidateInstructorRole(result.userId);
  return result;
}

export async function grantInstructorWithAssignmentsAction(
  input: GrantInstructorWithAssignmentsInput,
): Promise<GrantInstructorWithAssignmentsResult> {
  const { inviteInstructor } = await import("./services/inviteInstructor");
  const result = await inviteInstructor(input);
  if (result.ok) {
    revalidatePath("/academy/admin");
    revalidatePath("/academy/admin/instructors");
    if (result.userId) revalidatePath(`/academy/admin/instructors/${result.userId}`);
    revalidatePath("/academy/instructor");
    revalidatePath("/academy/instructor/programs");
  }
  return result;
}

export async function resendInstructorInviteAction(input: {
  email: string;
  displayName: string;
}): Promise<InviteInstructorResult> {
  const { resendInstructorInvite } = await import("./services/resendInstructorInvite");
  return resendInstructorInvite(input);
}
