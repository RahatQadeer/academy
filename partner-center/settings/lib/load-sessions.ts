import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";

export type PartnerAuthSession = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  refreshedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  isCurrent: boolean;
  label: string;
  detail: string;
};

type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  refreshed_at: string | null;
  user_agent: string | null;
  ip: string | null;
  is_current: boolean;
};

function parseDeviceLabel(userAgent: string | null): string {
  if (!userAgent?.trim()) return "Unknown device";

  const ua = userAgent;
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  let os = "device";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${browser} on ${os}`;
}

function formatActiveDetail(session: {
  isCurrent: boolean;
  refreshedAt: string | null;
  updatedAt: string | null;
  createdAt: string;
  ip: string | null;
}): string {
  if (session.isCurrent) {
    return session.ip ? `${session.ip} · Current session` : "Current session";
  }

  const stamp = session.refreshedAt || session.updatedAt || session.createdAt;
  const date = new Date(stamp);
  const when = Number.isNaN(date.getTime())
    ? "Earlier"
    : `Last active ${date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;

  return session.ip ? `${session.ip} · ${when}` : when;
}

export async function loadPartnerAuthSessions(): Promise<PartnerAuthSession[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_auth_sessions");
  if (error || !data) return [];

  return (data as SessionRow[]).map((row) => {
    const mapped = {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      refreshedAt: row.refreshed_at,
      userAgent: row.user_agent,
      ip: row.ip,
      isCurrent: row.is_current === true,
    };
    return {
      ...mapped,
      label: parseDeviceLabel(row.user_agent),
      detail: formatActiveDetail(mapped),
    };
  });
}
