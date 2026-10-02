export const ADMIN_NAV_SEEN_COOKIE = "academy_admin_nav_seen";

export type AdminNavSeenState = {
  userId: string;
  enrollmentsSeenAt?: string;
};

export function parseAdminNavSeen(
  raw: string | undefined,
  userId: string,
): AdminNavSeenState {
  if (!raw) return { userId };
  try {
    const parsed = JSON.parse(raw) as Partial<AdminNavSeenState>;
    if (parsed.userId !== userId) return { userId };
    const enrollmentsSeenAt =
      typeof parsed.enrollmentsSeenAt === "string" &&
      !Number.isNaN(Date.parse(parsed.enrollmentsSeenAt))
        ? parsed.enrollmentsSeenAt
        : undefined;
    return { userId, enrollmentsSeenAt };
  } catch {
    return { userId };
  }
}

export function isAdminEnrollmentsPath(pathname: string) {
  return (
    pathname === "/academy/admin/enrollments" ||
    pathname.startsWith("/academy/admin/enrollments/")
  );
}
