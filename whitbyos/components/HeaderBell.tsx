import { headers } from "next/headers";
import { NotificationBell } from "@/whitbyos/components/NotificationBell";
import { countUnread, listNotices } from "@/whitbyos/lib/notifications";

/**
 * The bell, read on the server and dropped into the shell's header slot.
 *
 * `x-pa-pathname` is set by the middleware on every request, so the panel knows
 * which page it was opened on and can send an answer back to it.
 */
export async function HeaderBell() {
  const [notices, unread, head] = await Promise.all([
    listNotices(),
    countUnread(),
    headers(),
  ]);

  return (
    <NotificationBell
      notices={notices}
      unread={unread}
      here={head.get("x-pa-pathname") || "/whitbyos"}
    />
  );
}
