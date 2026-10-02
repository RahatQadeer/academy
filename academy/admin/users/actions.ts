"use server";

import { revalidatePath } from "next/cache";
import type {
  ListManagedUsersInput,
  ListManagedUsersResult,
  SetUserStatusAction,
  SetUserStatusResult,
} from "./types";

function revalidateUsers() {
  revalidatePath("/academy/admin");
  revalidatePath("/academy/admin/users");
}

export async function listManagedUsersAction(
  input: ListManagedUsersInput = {},
): Promise<ListManagedUsersResult> {
  const { listManagedUsers } = await import("./services/listManagedUsers");
  return listManagedUsers(input);
}

export async function setUserAccountStatusAction(
  userId: string,
  action: SetUserStatusAction,
): Promise<SetUserStatusResult> {
  const { setUserAccountStatus } = await import("./services/setUserAccountStatus");
  const result = await setUserAccountStatus(userId, action);
  if (result.ok) revalidateUsers();
  return result;
}
