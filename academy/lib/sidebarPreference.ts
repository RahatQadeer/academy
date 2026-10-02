export const ACADEMY_SIDEBAR_COLLAPSED_COOKIE = "academy-sidebar-collapsed";
export const ACADEMY_SIDEBAR_COLLAPSED_STORAGE = "academy-sidebar-collapsed";

export function persistAcademySidebarCollapsed(collapsed: boolean) {
  const value = collapsed ? "1" : "0";
  try {
    window.localStorage.setItem(ACADEMY_SIDEBAR_COLLAPSED_STORAGE, value);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${ACADEMY_SIDEBAR_COLLAPSED_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
