import "server-only";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/base/lib/supabase/server";
import { createServiceClient } from "@/base/lib/supabase/service";
import {
  inAppRecipients,
  isUnreadDuplicate,
  portalRecipients,
  type PortalMember,
} from "@/whitbyos/lib/notify-recipients";
import { readAreas, toPersonRole } from "@/client-portal/lib/access";
import type { NotificationEvent as PortalEvent, PortalArea } from "@/client-portal/types";

const ROUTE = "/[product]/[[...slug]]";

/**
 * The in-app events 17.3 offers. `kind` on the notice matches the pref key.
 *
 * `gmailContext` is the third, and the only one raised by something other than
 * a person: a connected mailbox brought in a message Whitby judged relevant to
 * a client. It carries a pref key like the other two, so it can be switched off
 * by anyone who does not want the mailbox ringing their bell — a notice nobody
 * asked for and nobody can stop is the one kind worth refusing to ship.
 *
 * `clientRequest` is raised from the Client Portal: a client asked for
 * something, and it is sitting in Requests as `private_to_requestor` where
 * nobody would otherwise notice it had arrived.
 */
export const IN_APP = {
  documentReview: "document_review",
  formSubmission: "form_submission",
  gmailContext: "gmail_context",
  clientRequest: "client_request",
  /*
   * A client has asked for somebody to be given access to their account.
   *
   * The professional's own screen for answering it has existed since §4.9 —
   * a panel on the client's Contacts tab with a Review button — and nothing
   * ever pointed at it. The only switch for this event was on the email
   * channel, and this product sends no email, so a request sat in a queue
   * until somebody happened to open that one tab on that one client.
   */
  accessRequest: "access_request",
  /*
   * A client ticked one of their own tasks off, or put one back.
   *
   * client-portal/020 lets them: a task asking the client for something used
   * to stay open until somebody in the firm closed it, and the point of
   * letting the client close it is that nobody has to chase them for an
   * answer they already gave. Which only holds if the firm is told, so this
   * is the event that tells them.
   */
  clientTaskUpdate: "client_task_update",
} as const;

export type InAppEvent = (typeof IN_APP)[keyof typeof IN_APP];

/**
 * Write a bell notice for every workspace member who still wants this event.
 *
 * Prefs are per-person and `whitbyos_notification_prefs` is readable only as
 * yourself, so the service role is what can honour everybody's toggle. Absence
 * of a pref row still means on, matching 17.3.
 *
 * With no service key, the signed-in member is told about their own event if
 * they left the toggle on — enough for a professional upload, not enough for
 * a client submission, which cannot insert a professional's notice under RLS.
 *
 * Returns how many rows were inserted. Zero is success: nobody opted in, the
 * event already has an unread notice, or this environment cannot write one.
 */
export async function notifyWorkspaceMembers(input: {
  workspaceId: string;
  event: InAppEvent;
  /**
   * Stored as the notice's `kind`, and what an unread duplicate is judged on.
   * Defaults to `event`, which is right where one event happens once per
   * thing — and wrong where the same event happens again about the same thing
   * and is news each time: a client answering a correction on a submission
   * they had already submitted was suppressed as a repeat of the first.
   *
   * The same field the portal's `ClientNotice` has carried all along.
   */
  kind?: string;
  title: string;
  body: string;
  href: string;
  entityType: string;
  entityId: string;
  skipUserId?: string | null;
}): Promise<number> {
  try {
    const service = createServiceClient();
    if (service) return await deliver(service, input, null);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    return await deliver(supabase, input, user.id);
  } catch {
    return 0;
  }
}

async function deliver(
  supabase: SupabaseClient,
  input: {
    workspaceId: string;
    event: InAppEvent;
    kind?: string;
    title: string;
    body: string;
    href: string;
    entityType: string;
    entityId: string;
    skipUserId?: string | null;
  },
  onlyUserId: string | null,
) {
  const memberIds = await activeMemberIds(supabase, input.workspaceId);
  const candidates = onlyUserId
    ? memberIds.filter((id) => id === onlyUserId)
    : memberIds;
  if (candidates.length === 0) return 0;

  const off = await optedOut(supabase, input.workspaceId, input.event, candidates);
  const recipients = inAppRecipients(candidates, off, input.skipUserId);
  if (recipients.length === 0) return 0;

  // The pref switch above is the event; what is stored, and what a duplicate
  // is judged on, is the kind.
  const kind = input.kind ?? input.event;

  const { data: open } = await supabase
    .from("whitbyos_notifications")
    .select("recipient_user_id, kind, entity_id")
    .eq("workspace_id", input.workspaceId)
    .eq("kind", kind)
    .eq("entity_id", input.entityId)
    .in("recipient_user_id", recipients)
    .is("read_at", null);

  const already = (open ?? []).flatMap((row) => {
    const recipientUserId = row.recipient_user_id as string | null;
    const entityId = row.entity_id as string | null;
    if (!recipientUserId || !entityId) return [];
    return [{ recipientUserId, kind: row.kind as string, entityId }];
  });

  const fresh = recipients.filter(
    (userId) =>
      !isUnreadDuplicate(already, {
        recipientUserId: userId,
        kind,
        entityId: input.entityId,
      }),
  );

  if (fresh.length === 0) return 0;

  let inserted = 0;
  for (const userId of fresh) {
    const { error } = await supabase.from("whitbyos_notifications").insert({
      workspace_id: input.workspaceId,
      recipient_user_id: userId,
      recipient_contact_id: null,
      kind,
      title: input.title,
      body: input.body,
      href: input.href,
      entity_type: input.entityType,
      entity_id: input.entityId,
    });
    if (!error) inserted += 1;
  }

  if (inserted > 0) revalidatePath(ROUTE, "page");
  return inserted;
}

/**
 * Tell named people, rather than everybody in the workspace.
 *
 * `notifyWorkspaceMembers` is for an event the whole firm is entitled to hear
 * about — a document to review, a form that came in. Being added to a
 * conversation is not that: it is news for the four people who were added and
 * for nobody else, and telling the other eleven would be telling them a group
 * exists that they are not in.
 *
 * No pref switch, because there is none to consult: 17.3 lists the events a
 * person can refuse, and this is not one of them. It is addressed to you
 * personally, the way a message is.
 */
export async function notifyPeople(input: {
  workspaceId: string;
  userIds: string[];
  kind: string;
  title: string;
  body: string | null;
  href: string;
  entityType: string;
  entityId: string;
  skipUserId?: string | null;
}): Promise<number> {
  const recipients = [...new Set(input.userIds.filter(Boolean))].filter(
    (id) => id !== input.skipUserId,
  );
  if (recipients.length === 0) return 0;

  try {
    const supabase = createServiceClient() ?? (await createClient());

    let inserted = 0;
    for (const userId of recipients) {
      const { error } = await supabase.from("whitbyos_notifications").insert({
        workspace_id: input.workspaceId,
        recipient_user_id: userId,
        recipient_contact_id: null,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
        entity_type: input.entityType,
        entity_id: input.entityId,
      });
      if (!error) inserted += 1;
    }

    if (inserted > 0) revalidatePath(ROUTE, "page");
    return inserted;
  } catch {
    return 0;
  }
}

async function activeMemberIds(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  return [...new Set((data ?? []).map((row) => row.user_id as string).filter(Boolean))];
}

async function optedOut(
  supabase: SupabaseClient,
  workspaceId: string,
  event: InAppEvent,
  memberIds: string[],
) {
  const { data } = await supabase
    .from("whitbyos_notification_prefs")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("event_type", event)
    .eq("channel", "in_app")
    .eq("enabled", false)
    .in("user_id", memberIds);

  return (data ?? []).map((row) => row.user_id as string);
}

/* ------------------------------------------------------------------------- */
/* The other direction: from the professional to the people on a client.     */
/* ------------------------------------------------------------------------- */

type ClientNotice = {
  workspaceId: string;
  /** The client account. Null only when `onlyContactIds` names the people. */
  clientId: string | null;
  /** The switch on the portal's Notifications screen that can refuse it. */
  event: PortalEvent;
  /** The portal area the notice is about; nobody without it is told. */
  area: PortalArea;
  /** Stored as the notice's `kind`. Defaults to `event`. */
  kind?: string;
  title: string;
  body: string | null;
  href: string;
  entityType: string;
  entityId: string;
  /** Narrow to these contacts. Null or absent means everyone on the account. */
  onlyContactIds?: string[] | null;
};

/**
 * Write a portal bell notice for every person on a client account who should
 * hear about this, and still wants to.
 *
 * The service role is not a convenience here, it is the only way to do this
 * honestly. `client_portal_notification_prefs` and `client_portal_identities`
 * are readable only by the contact they belong to (client-portal/001), so read
 * from a professional's session both come back empty: nobody looks like they
 * are in the portal, and nobody looks like they switched anything off. The
 * invoice send did exactly that and told people who had refused it.
 *
 * With no service key nothing is written. A notice to a client who switched it
 * off is the one outcome worth avoiding, and without the key there is no way
 * to know.
 *
 * The portal's switches are saved against the `email` channel, because that is
 * what its Notifications screen writes; they are the client's answer to "tell
 * me about this", whichever way the telling arrives.
 *
 * Returns how many people were told. Zero is success.
 */
export async function notifyClientContacts(input: ClientNotice): Promise<number> {
  if (input.onlyContactIds && input.onlyContactIds.length === 0) return 0;
  if (!input.clientId && !input.onlyContactIds) return 0;

  try {
    const service = createServiceClient();
    if (!service) return 0;
    return await deliverToContacts(service, input);
  } catch {
    return 0;
  }
}

/**
 * The same, for something that hangs off a Request, told to exactly the people
 * the portal would show that Request to.
 *
 * `client_account` is everyone on the account; `selected_people` and
 * `private_to_requestor` are the contacts on its participant list — the rule
 * `listRequests` in client-portal/lib/data/requests.ts renders by. Telling a
 * person a Request's title is telling them the Request exists, so it cannot be
 * any wider than that.
 *
 * `workspaceId` is the caller's own current workspace, and a Request from any
 * other is refused: the lookup runs as the service role, so this check is what
 * stands between a typed id and somebody else's clients.
 */
export async function notifyRequestAudience(
  input: Omit<ClientNotice, "clientId" | "onlyContactIds" | "body"> & {
    requestId: string;
    /** Defaults to the Request's own title. */
    body?: string | null;
  },
): Promise<number> {
  try {
    const service = createServiceClient();
    if (!service) return 0;

    const { data: request } = await service
      .from("whitbyos_requests")
      .select("client_id, workspace_id, title, visibility")
      .eq("id", input.requestId)
      .maybeSingle();

    if (!request?.client_id || request.workspace_id !== input.workspaceId) return 0;

    let only: string[] | null = null;
    if (request.visibility !== "client_account") {
      const { data: rows } = await service
        .from("whitbyos_request_participants")
        .select("participant_id")
        .eq("request_id", input.requestId)
        .eq("participant_type", "contact");
      only = (rows ?? []).map((row) => row.participant_id as string);
    }

    return await deliverToContacts(service, {
      ...input,
      clientId: request.client_id as string,
      body: input.body === undefined ? ((request.title as string | null) ?? null) : input.body,
      onlyContactIds: only,
    });
  } catch {
    return 0;
  }
}

async function deliverToContacts(supabase: SupabaseClient, input: ClientNotice) {
  if (input.onlyContactIds && input.onlyContactIds.length === 0) return 0;

  const members = await clientMembers(supabase, input);
  const contactIds = [...new Set(members.map((member) => member.contactId))];
  if (contactIds.length === 0) return 0;

  const [identities, prefs] = await Promise.all([
    supabase.from("client_portal_identities").select("contact_id").in("contact_id", contactIds),
    supabase
      .from("client_portal_notification_prefs")
      .select("contact_id")
      .eq("event_type", input.event)
      .eq("channel", "email")
      .eq("enabled", false)
      .in("contact_id", contactIds),
  ]);

  const recipients = portalRecipients(
    members,
    (identities.data ?? []).map((row) => row.contact_id as string),
    (prefs.data ?? []).map((row) => row.contact_id as string),
    input.onlyContactIds,
  );
  if (recipients.length === 0) return 0;

  const kind = input.kind ?? input.event;

  // Same rule as a member's bell (whitbyos/069, and client-portal/012 for
  // this side): an unread notice about this already is this notice.
  const { data: open } = await supabase
    .from("whitbyos_notifications")
    .select("recipient_contact_id")
    .eq("kind", kind)
    .eq("entity_id", input.entityId)
    .in("recipient_contact_id", recipients)
    .is("read_at", null);

  const already = new Set((open ?? []).map((row) => row.recipient_contact_id as string));
  const fresh = recipients.filter((id) => !already.has(id));
  if (fresh.length === 0) return 0;

  let inserted = 0;
  for (const contactId of fresh) {
    const { error } = await supabase.from("whitbyos_notifications").insert({
      workspace_id: input.workspaceId,
      recipient_user_id: null,
      recipient_contact_id: contactId,
      kind,
      title: input.title,
      body: input.body,
      href: input.href,
      entity_type: input.entityType,
      entity_id: input.entityId,
    });
    if (!error) inserted += 1;
  }

  if (inserted > 0) revalidatePath(ROUTE, "page");
  return inserted;
}

type MemberRow = {
  contact_id: string | null;
  role: string | null;
  portal_access: boolean | null;
  permissions?: unknown;
  whitbyos_clients: { workspace_id: string | null } | { workspace_id: string | null }[] | null;
};

const MEMBER_COLUMNS = "contact_id, role, portal_access, whitbyos_clients(workspace_id)";

/**
 * The memberships a notice could reach, each resolved to whether it holds the
 * area — by `readAreas`, the same reader the portal gates its own screens with.
 *
 * `permissions` is asked for and then dropped if the column is not there, for
 * the reason `resolveMembership` in portal-context gives: an environment a
 * migration behind answers the whole select with an error.
 */
async function clientMembers(
  supabase: SupabaseClient,
  input: ClientNotice,
): Promise<PortalMember[]> {
  const read = (columns: string) => {
    const query = supabase.from("whitbyos_client_members").select(columns);
    return input.clientId
      ? query.eq("client_id", input.clientId)
      : query.in("contact_id", input.onlyContactIds ?? []);
  };

  let result = await read(`${MEMBER_COLUMNS}, permissions`);
  if (result.error) result = await read(MEMBER_COLUMNS);

  const rows = (result.data ?? []) as unknown as MemberRow[];

  return rows.flatMap((row) => {
    const client = Array.isArray(row.whitbyos_clients)
      ? row.whitbyos_clients[0]
      : row.whitbyos_clients;
    if (!row.contact_id || client?.workspace_id !== input.workspaceId) return [];

    return [
      {
        contactId: row.contact_id,
        portalAccess: row.portal_access,
        reachesArea: readAreas(row.permissions, toPersonRole(row.role)).areas[input.area],
      },
    ];
  });
}
