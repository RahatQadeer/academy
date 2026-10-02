import "server-only";

import { cache } from "react";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import {
  contactDisplayName,
  initialsFromName,
  staffDisplay,
} from "@/partner-center/messages/lib/format";
import { messageIsRead } from "@/partner-center/messages/lib/read-status";
import { getActivePartnerAdmin } from "@/partner-center/admin/lib/require-partner-admin";
import {
  createAdminClient,
  isAdminDataConfigured,
} from "@/super-admin/partner-center/lib/admin-client";
import { getStaffSession } from "@/super-admin/lib/staff-session";
import { redirect } from "next/navigation";
import type {
  AdminMessageThread,
  AdminMessageThreadItem,
  AdminThreadMessage,
} from "@/super-admin/partner-center/messages/types";

async function requirePcStaffAccess() {
  const staff = await getStaffSession();
  if (staff?.email) return;
  const partnerAdmin = await getActivePartnerAdmin();
  if (partnerAdmin) return;
  const { headers } = await import("next/headers");
  const headerList = await headers();
  const pathname =
    headerList.get("x-pathname") || headerList.get("x-pa-pathname") || "";
  if (pathname.startsWith("/partner-center/admin")) {
    redirect("/partner-center/admin/signin");
  }
  redirect("/super-admin/signin");
}

type ProfileRow = {
  id: string;
  company_id: string | null;
  primary_contact_id: string | null;
  status: string;
  application_data: unknown;
};

type MessageRow = {
  id: string;
  partner_profile_id: string;
  sender_type: "partner" | "staff";
  sender_contact_id: string | null;
  body: string;
  created_at: string;
};

function contactName(contact: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
} | null): string {
  if (!contact) return "—";
  return contactDisplayName(contact);
}

async function loadContactsAndCompanies(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  companyIds: string[],
  contactIds: string[],
) {
  const companyNameById = new Map<string, string>();
  const contactById = new Map<
    string,
    { name: string; email: string | null }
  >();

  await Promise.all([
    companyIds.length > 0
      ? admin
          .from("companies")
          .select("id, name")
          .in("id", companyIds)
          .then(({ data }) => {
            for (const row of data ?? []) {
              const name = (row.name as string | null)?.trim();
              if (name) companyNameById.set(row.id as string, name);
            }
          })
      : Promise.resolve(),
    contactIds.length > 0
      ? admin
          .from("contacts")
          .select("id, first_name, last_name, preferred_name, email")
          .in("id", contactIds)
          .then(({ data }) => {
            for (const row of data ?? []) {
              contactById.set(row.id as string, {
                name: contactName(row as Parameters<typeof contactName>[0]),
                email: (row.email as string | null) ?? null,
              });
            }
          })
      : Promise.resolve(),
  ]);

  return { companyNameById, contactById };
}

function resolveCompanyName(
  row: ProfileRow,
  companyNameById: Map<string, string>,
): string {
  const application = parseApplicationData(row.application_data);
  return (
    (row.company_id && companyNameById.get(row.company_id)) ||
    application.legal_name ||
    "—"
  );
}

function resolveContact(
  row: ProfileRow,
  contactById: Map<string, { name: string; email: string | null }>,
): { name: string; email: string } {
  const application = parseApplicationData(row.application_data);
  const contact = row.primary_contact_id
    ? contactById.get(row.primary_contact_id)
    : undefined;
  return {
    name: contact?.name || application.primary_contact_name || "—",
    email: contact?.email || application.email || "—",
  };
}

function isMessagesUnavailable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /partner_messages|does not exist|schema cache/i.test(error.message ?? "")
  );
}

export const loadMessageThreads = cache(async function loadMessageThreads(options?: {
  channel?: "partner_manager" | "support_billing";
}): Promise<{
  items: AdminMessageThreadItem[];
  configured: boolean;
  error?: string;
  unreadThreadCount: number;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { items: [], configured: false, unreadThreadCount: 0 };
  }

  const admin = createAdminClient();
  if (!admin) return { items: [], configured: false, unreadThreadCount: 0 };

  const { data, error } = await admin
    .from("partner_profiles")
    .select("id, company_id, primary_contact_id, status, application_data")
    .in("status", ["approved", "active"])
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      items: [],
      configured: true,
      error: error.message,
      unreadThreadCount: 0,
    };
  }

  const rows = (data ?? []) as ProfileRow[];
  if (rows.length === 0) {
    return { items: [], configured: true, unreadThreadCount: 0 };
  }

  const companyIds = [
    ...new Set(rows.map((r) => r.company_id).filter(Boolean) as string[]),
  ];
  const contactIds = [
    ...new Set(
      rows.map((r) => r.primary_contact_id).filter(Boolean) as string[],
    ),
  ];
  const profileIds = rows.map((r) => r.id);

  let messagesQuery = admin
    .from("partner_messages")
    .select(
      "id, partner_profile_id, sender_type, sender_contact_id, body, created_at, channel",
    )
    .in("partner_profile_id", profileIds)
    .order("created_at", { ascending: false });
  if (options?.channel) {
    messagesQuery = messagesQuery.eq("channel", options.channel);
  }

  let staffReadsQuery = admin
    .from("partner_message_staff_reads")
    .select("partner_profile_id, channel, last_read_at")
    .in("partner_profile_id", profileIds);
  if (options?.channel) {
    staffReadsQuery = staffReadsQuery.eq("channel", options.channel);
  }

  const [{ companyNameById, contactById }, messagesRes, staffReadsRes] =
    await Promise.all([
      loadContactsAndCompanies(admin, companyIds, contactIds),
      messagesQuery,
      staffReadsQuery,
    ]);

  if (messagesRes.error && !isMessagesUnavailable(messagesRes.error)) {
    return {
      items: [],
      configured: true,
      error: messagesRes.error.message,
      unreadThreadCount: 0,
    };
  }
  if (messagesRes.error) {
    console.warn(
      "[admin-messages] table unavailable; listing partners with empty threads",
      messagesRes.error.code,
      messagesRes.error.message,
    );
  }

  const staffReadByProfile = new Map<string, string>();
  if (!staffReadsRes.error) {
    for (const row of staffReadsRes.data ?? []) {
      staffReadByProfile.set(
        row.partner_profile_id as string,
        row.last_read_at as string,
      );
    }
  }

  const latestByProfile = new Map<
    string,
    { row: MessageRow; count: number }
  >();
  const allSenderContactIds = new Set<string>();
  for (const raw of messagesRes.error ? [] : messagesRes.data ?? []) {
    const row = raw as MessageRow;
    if (row.sender_contact_id) allSenderContactIds.add(row.sender_contact_id);
    const existing = latestByProfile.get(row.partner_profile_id);
    if (!existing) {
      latestByProfile.set(row.partner_profile_id, { row, count: 1 });
    } else {
      existing.count += 1;
    }
  }

  const senderNames = new Map<string, string>();
  const missingSenderIds = [...allSenderContactIds].filter(
    (id) => !contactById.has(id),
  );
  if (missingSenderIds.length > 0) {
    const { data: contacts } = await admin
      .from("contacts")
      .select("id, preferred_name, first_name, last_name")
      .in("id", missingSenderIds);
    for (const c of contacts ?? []) {
      senderNames.set(
        c.id as string,
        contactDisplayName(c as Parameters<typeof contactDisplayName>[0]),
      );
    }
  }
  for (const [id, info] of contactById) {
    senderNames.set(id, info.name);
  }

  const staff = staffDisplay();
  const items: AdminMessageThreadItem[] = rows.map((row) => {
    const contact = resolveContact(row, contactById);
    const latest = latestByProfile.get(row.id);
    const last = latest?.row;
    let lastSenderName: string | null = null;
    if (last?.sender_type === "staff") {
      lastSenderName = "You";
    } else if (last?.sender_type === "partner") {
      lastSenderName =
        (last.sender_contact_id && senderNames.get(last.sender_contact_id)) ||
        contact.name;
    }

    const staffRead = staffReadByProfile.get(row.id) ?? null;
    const needsReply = last?.sender_type === "partner";
    const unreadFromPartner = Boolean(
      needsReply &&
        last &&
        (!staffRead || last.created_at > staffRead),
    );

    return {
      profileId: row.id,
      companyName: resolveCompanyName(row, companyNameById),
      contactName: contact.name,
      contactEmail: contact.email,
      status: row.status,
      lastBody: last?.body ?? null,
      lastSenderType: last?.sender_type ?? null,
      lastSenderName,
      lastSentAt: last?.created_at ?? null,
      needsReply,
      unreadFromPartner,
      messageCount: latest?.count ?? 0,
    };
  });

  items.sort((a, b) => {
    if (a.unreadFromPartner !== b.unreadFromPartner) {
      return a.unreadFromPartner ? -1 : 1;
    }
    if (a.lastSentAt && b.lastSentAt) {
      return b.lastSentAt.localeCompare(a.lastSentAt);
    }
    if (a.lastSentAt) return -1;
    if (b.lastSentAt) return 1;
    return a.companyName.localeCompare(b.companyName);
  });

  return {
    items,
    configured: true,
    unreadThreadCount: items.filter((i) => i.unreadFromPartner).length,
  };
});

export async function loadMessageThread(
  profileId: string,
  options?: { channel?: "partner_manager" | "support_billing" },
): Promise<{
  data: AdminMessageThread | null;
  configured: boolean;
  error?: string;
}> {
  await requirePcStaffAccess();
  if (!isAdminDataConfigured()) {
    return { data: null, configured: false };
  }

  const admin = createAdminClient();
  if (!admin) return { data: null, configured: false };

  const { data: profile, error: profileError } = await admin
    .from("partner_profiles")
    .select("id, company_id, primary_contact_id, status, application_data")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    return { data: null, configured: true, error: profileError.message };
  }
  if (!profile) {
    return { data: null, configured: true };
  }

  const row = profile as ProfileRow;
  const companyIds = row.company_id ? [row.company_id] : [];
  const contactIds = row.primary_contact_id ? [row.primary_contact_id] : [];

  let messagesQuery = admin
    .from("partner_messages")
    .select(
      "id, partner_profile_id, sender_type, sender_contact_id, body, created_at, channel",
    )
    .eq("partner_profile_id", profileId)
    .order("created_at", { ascending: true });
  if (options?.channel) {
    messagesQuery = messagesQuery.eq("channel", options.channel);
  }

  const [{ companyNameById, contactById }, messagesRes, partnerReadsRes] =
    await Promise.all([
      loadContactsAndCompanies(admin, companyIds, contactIds),
      messagesQuery,
      admin
        .from("partner_message_reads")
        .select("last_read_at")
        .eq("partner_profile_id", profileId)
        .order("last_read_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (messagesRes.error && !isMessagesUnavailable(messagesRes.error)) {
    return { data: null, configured: true, error: messagesRes.error.message };
  }
  if (messagesRes.error) {
    console.warn(
      "[admin-messages] table unavailable; opening empty thread",
      messagesRes.error.code,
      messagesRes.error.message,
    );
  }

  const messageRows = (
    messagesRes.error ? [] : (messagesRes.data ?? [])
  ) as MessageRow[];
  const senderContactIds = [
    ...new Set(
      messageRows
        .map((m) => m.sender_contact_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const senderNames = new Map<string, string>();
  if (senderContactIds.length > 0) {
    const { data: contacts } = await admin
      .from("contacts")
      .select("id, preferred_name, first_name, last_name")
      .in("id", senderContactIds);
    for (const c of contacts ?? []) {
      senderNames.set(
        c.id as string,
        contactDisplayName(c as Parameters<typeof contactDisplayName>[0]),
      );
    }
  }

  const contact = resolveContact(row, contactById);
  const staff = staffDisplay();
  const fallbackPartnerName = contact.name === "—" ? "Partner" : contact.name;
  const partnerLastReadAt =
    (partnerReadsRes.data as { last_read_at?: string } | null)?.last_read_at ??
    null;

  const messages: AdminThreadMessage[] = messageRows.map((m) => {
    if (m.sender_type === "staff") {
      return {
        id: m.id,
        senderType: "staff",
        authorName: staff.name,
        authorInitials: staff.initials,
        body: m.body,
        sentAt: m.created_at,
        isStaff: true,
        readStatus: messageIsRead(m.created_at, partnerLastReadAt)
          ? "read"
          : "sent",
      };
    }

    const name =
      (m.sender_contact_id && senderNames.get(m.sender_contact_id)) ||
      fallbackPartnerName;
    return {
      id: m.id,
      senderType: "partner",
      authorName: name,
      authorInitials: initialsFromName(name),
      body: m.body,
      sentAt: m.created_at,
      isStaff: false,
    };
  });

  return {
    data: {
      profileId: row.id,
      companyName: resolveCompanyName(row, companyNameById),
      contactName: contact.name,
      contactEmail: contact.email,
      status: row.status,
      messages,
      partnerLastReadAt,
    },
    configured: true,
  };
}
