export type MessageReadStatus = "sent" | "read";

export function messageIsRead(
  sentAt: string,
  otherSideLastReadAt: string | null | undefined,
): boolean {
  if (!otherSideLastReadAt) return false;
  return sentAt <= otherSideLastReadAt;
}
