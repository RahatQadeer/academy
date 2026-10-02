import { createClient } from "@/base/lib/supabase/server";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { listClientDocuments, type ClientDocument } from "@/whitbyos/lib/client-detail";
import { listThreadsForRequest, type RequestThread } from "@/whitbyos/lib/messages";
import { nameOfProvider } from "@/whitbyos/lib/providers";

export type RequestTab =
  | ""
  | "tasks"
  | "notes"
  | "documents"
  | "work-plans"
  | "forms"
  | "providers"
  | "messages";

export const REQUEST_TABS: { slug: RequestTab; label: string }[] = [
  { slug: "", label: "Overview" },
  { slug: "tasks", label: "Tasks" },
  { slug: "notes", label: "Notes" },
  { slug: "documents", label: "Documents" },
  { slug: "work-plans", label: "Work Plans" },
  { slug: "forms", label: "Forms" },
  { slug: "providers", label: "Providers" },
  { slug: "messages", label: "Messages" },
];

export const REQUEST_TAB_SLUGS = new Set(REQUEST_TABS.map((tab) => tab.slug));

export type RequestTask = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  ownerName: string | null;
  ownerId: string | null;
  ownerPhoto: string | null;
  /** The Work Plan this task's stream belongs to, or null for a loose task. */
  planId: string | null;
  planName: string | null;
};

export type RequestNote = {
  id: string;
  body: string;
  visibility: string;
  authorName: string | null;
  authorPhoto: string | null;
  createdAt: string;
};

export type RequestPlan = {
  id: string;
  name: string;
  status: string;
  targetDate: string | null;
  tasksTotal: number;
  tasksDone: number;
};

export type RequestPerson = { name: string; role: string };

export type RequestForm = {
  id: string;
  formId: string;
  title: string;
  status: string;
  sentAt: string | null;
  updatedAt: string | null;
};

export type RequestProvider = {
  optionId: string;
  providerId: string;
  name: string;
  category: string | null;
  outreach: string | null;
  lastContact: string | null;
  nextStep: string | null;
};

/** Directory providers filed to this Request's client, not yet engaged here. */
export type RequestRelatedProvider = {
  id: string;
  name: string;
  category: string | null;
  outreach: string | null;
};

export type RequestEvent = {
  id: string;
  title: string;
  startAt: string | null;
};

export type RequestDetail = {
  id: string;
  title: string;
  status: string;
  outcome: string | null;
  /** 3.3x edits it; migration 010 put it on the Request. */
  urgency: string | null;
  definitionOfDone: string | null;
  targetDate: string | null;
  createdAt: string;
  closedAt: string | null;
  workSummary: string | null;
  clientId: string | null;
  clientName: string | null;
  ownerName: string | null;
  /** "Step 3 of 7" — where this Request has got to across its plans. */
  stepDone: number;
  stepTotal: number;
  tasks: RequestTask[];
  notes: RequestNote[];
  documents: ClientDocument[];
  plans: RequestPlan[];
  people: RequestPerson[];
  providers: string[];
  providerRows: RequestProvider[];
  relatedProviders: RequestRelatedProvider[];
  forms: RequestForm[];
  eventsThisWeek: RequestEvent[];
  outstanding: { id: string; body: string }[];
  /** The conversations somebody filed under this Request with Add to Request. */
  conversations: RequestThread[];
};

const DONE = new Set(["complete", "completed", "done"]);

/**
 * Screens 3.3o–3.3w — one Request and everything hanging off it.
 *
 * The five tabs are five views of one record, so this reads all of it once
 * rather than each tab fetching its own: the header shows counts from every
 * tab, and five queries per navigation to render one heading is worse than one
 * query that answers them all.
 */
export async function getRequestDetail(requestId: string): Promise<RequestDetail | null> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return null;

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("whitbyos_requests")
    .select(
      "id, title, status, urgency, desired_outcome, definition_of_done, target_date, created_at, closed_at, work_summary, owner_user_id, workspace_id, client:whitbyos_clients!client_id (id, name)",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (!request || request.workspace_id !== workspaceId) return null;

  const client = Array.isArray(request.client) ? request.client[0] : request.client;

  const [{ data: taskRows }, { data: noteRows }, { data: planRows }, { data: participants }] =
    await Promise.all([
      supabase
        .from("whitbyos_tasks")
        /* `workstream_id` so the Tasks tab can say which plan a task came
           from. Four hundred rows in one list is four hundred rows nobody
           can place, and a Request here carries sixteen plans. */
        .select("id, title, status, due_date, owner_user_id, workstream_id")
        .eq("request_id", requestId)
        .order("due_date", { nullsFirst: false }),
      supabase
        .from("whitbyos_notes")
        .select("id, body, visibility, created_by_user_id, created_at")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false }),
      supabase
        .from("whitbyos_workplans")
        .select("id, name, status, target_date")
        .eq("request_id", requestId)
        .order("created_at"),
      supabase
        .from("whitbyos_request_participants")
        .select("participant_type, participant_id, role")
        .eq("request_id", requestId),
    ]);

  // Every name this screen shows, resolved in one go rather than per row.
  const userIds = [
    ...new Set(
      [
        request.owner_user_id as string | null,
        ...(taskRows ?? []).map((row) => row.owner_user_id as string | null),
        ...(noteRows ?? []).map((row) => row.created_by_user_id as string | null),
        ...(participants ?? [])
          .filter((row) => row.participant_type === "user")
          .map((row) => row.participant_id as string),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, preferred_name, email")
      .in("id", userIds);

    for (const user of users ?? []) {
      names.set(
        user.id as string,
        (user.preferred_name as string) ||
          (user.full_name as string) ||
          (user.email as string) ||
          "Someone",
      );
    }
  }

  const { photosFor } = await import("@/whitbyos/lib/people-photos");
  const photos = await photosFor(supabase, { userIds, contactIds: [] });

  const contactIds = (participants ?? [])
    .filter((row) => row.participant_type === "contact")
    .map((row) => row.participant_id as string);

  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, preferred_name")
      .in("id", contactIds);

    for (const contact of contacts ?? []) {
      names.set(
        contact.id as string,
        (contact.preferred_name as string) ||
          [contact.first_name, contact.last_name].filter(Boolean).join(" "),
      );
    }
  }

  const companyIds = (participants ?? [])
    .filter((row) => row.participant_type === "company")
    .map((row) => row.participant_id as string);

  const providers: string[] = [];
  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);

    for (const company of companies ?? []) providers.push(company.name as string);
  }

  // Tasks per plan, for "14 of 27 tasks complete" on the Work Plans tab.
  const planIds = (planRows ?? []).map((row) => row.id as string);
  const planTasks = new Map<string, { total: number; done: number }>();
  /* Lifted out of the block below so the task list can use it too: it is
     the only thing that knows which plan a task's stream belongs to. */
  const streamPlan = new Map<string, string>();

  if (planIds.length > 0) {
    const { data: streams } = await supabase
      .from("whitbyos_workstreams")
      .select("id, workplan_id")
      .in("workplan_id", planIds);

    for (const row of streams ?? []) {
      streamPlan.set(row.id as string, row.workplan_id as string);
    }

    if (streamPlan.size > 0) {
      const { data: rows } = await supabase
        .from("whitbyos_tasks")
        .select("workstream_id, status")
        .in("workstream_id", [...streamPlan.keys()]);

      for (const row of rows ?? []) {
        const planId = streamPlan.get(row.workstream_id as string);
        if (!planId) continue;
        const entry = planTasks.get(planId) ?? { total: 0, done: 0 };
        entry.total += 1;
        if (DONE.has(((row.status as string) ?? "").toLowerCase())) entry.done += 1;
        planTasks.set(planId, entry);
      }
    }
  }

  // Whatever was filed here with Add to Request. Its own module, because
  // turning participants into names and faces is where the work is.
  const conversations = await listThreadsForRequest(requestId);

  // Outstanding items are open considerations against this Request's plans.
  const outstanding: { id: string; body: string }[] = [];
  if (planIds.length > 0) {
    const { data: considerations } = await supabase
      .from("whitbyos_considerations")
      .select("id, body")
      .in("workplan_id", planIds)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    for (const row of considerations ?? []) {
      outstanding.push({ id: row.id as string, body: row.body as string });
    }
  }

  /* Which plan a task belongs to, by way of the stream it sits in. The
     stream-to-plan map was already built above for the plan counts, so
     this costs nothing but a lookup. A task on no stream belongs to the
     Request itself and says so. */
  const planName = new Map((planRows ?? []).map((row) => [row.id as string, row.name as string]));

  const tasks: RequestTask[] = (taskRows ?? []).map((row) => {
    const ownerId = (row.owner_user_id as string | null) ?? null;
    const streamId = (row.workstream_id as string | null) ?? null;
    const planId = streamId ? streamPlan.get(streamId) ?? null : null;
    return {
      id: row.id as string,
      title: row.title as string,
      status: (row.status as string) ?? "not_started",
      dueDate: (row.due_date as string | null) ?? null,
      ownerName: ownerId ? names.get(ownerId) ?? null : null,
      ownerId,
      ownerPhoto: ownerId ? photos.get(ownerId) ?? null : null,
      planId,
      planName: planId ? planName.get(planId) ?? null : null,
    };
  });

  const documents = client?.id
    ? await listClientDocuments(client.id as string, [
        {
          id: requestId,
          title: request.title as string,
          status: "",
          target_date: null,
          created_at: "",
          updated_at: "",
        },
      ])
    : [];

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [{ data: formRows }, { data: optionRows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("whitbyos_form_submissions")
      .select(
        "id, form_id, status, sent_at, submitted_at, form:whitbyos_forms!form_id (title)",
      )
      .eq("request_id", requestId)
      .order("sent_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("whitbyos_provider_options")
      .select(
        "id, provider_id, status, provider:whitbyos_providers!provider_id (id, kind, outreach_status, last_contact_date, next_action, specialty_capability, contact:contacts!contact_id (first_name, last_name, preferred_name), company:companies!company_id (name, industry_type))",
      )
      .eq("request_id", requestId),
    supabase
      .from("whitbyos_calendar_events")
      .select("id, title, start_at")
      .eq("linked_request_id", requestId)
      .gte("start_at", weekStart.toISOString())
      .lt("start_at", weekEnd.toISOString())
      .order("start_at"),
  ]);

  const forms: RequestForm[] = (formRows ?? []).map((row) => {
    const form = Array.isArray(row.form) ? row.form[0] : row.form;
    return {
      id: row.id as string,
      formId: row.form_id as string,
      title: (form?.title as string | undefined) ?? "Untitled form",
      status: (row.status as string) ?? "awaiting",
      sentAt: (row.sent_at as string | null) ?? null,
      updatedAt: (row.submitted_at as string | null) ?? (row.sent_at as string | null) ?? null,
    };
  });

  const providerRows: RequestProvider[] = (optionRows ?? []).map((row) => {
    const provider = Array.isArray(row.provider) ? row.provider[0] : row.provider;
    const contact = Array.isArray(provider?.contact) ? provider?.contact[0] : provider?.contact;
    const company = Array.isArray(provider?.company) ? provider?.company[0] : provider?.company;
    const kind = (provider?.kind as string | null | undefined) ?? null;
    return {
      optionId: row.id as string,
      providerId: row.provider_id as string,
      name: nameOfProvider(kind, company, contact),
      category:
        (company?.industry_type as string | null | undefined) ??
        (provider?.specialty_capability as string | null | undefined) ??
        null,
      outreach: (provider?.outreach_status as string | null | undefined) ?? (row.status as string | null),
      lastContact: (provider?.last_contact_date as string | null | undefined) ?? null,
      nextStep: (provider?.next_action as string | null | undefined) ?? null,
    };
  });

  /*
   * Related = filed to this Request's client, not yet put on the Request.
   *
   * Only the top of the directory tree: the firm, or an independent person.
   * People who work at a firm already listed here are the detail behind that
   * firm, not four more rows all named after the building.
   */
  const engagedIds = new Set(providerRows.map((row) => row.providerId));
  const relatedProviders: RequestRelatedProvider[] = [];
  const clientId = (client?.id as string | null) ?? null;

  if (clientId) {
    const { data: relatedRows } = await supabase
      .from("whitbyos_providers")
      .select(
        "id, kind, company_id, outreach_status, specialty_capability, company:companies!company_id (name, industry_type, created_by_workspace_id), contact:contacts!contact_id (first_name, last_name, preferred_name, created_by_workspace_id)",
      )
      .eq("client_id", clientId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false });

    type RelatedDraft = RequestRelatedProvider & {
      type: "Company" | "Individual";
      companyId: string | null;
      parentId: string | null;
    };

    const drafts: RelatedDraft[] = [];

    for (const row of relatedRows ?? []) {
      if (engagedIds.has(row.id as string)) continue;

      const company = Array.isArray(row.company) ? row.company[0] : row.company;
      const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
      const mine =
        (company?.created_by_workspace_id as string | null | undefined) === workspaceId ||
        (contact?.created_by_workspace_id as string | null | undefined) === workspaceId;
      if (!mine) continue;

      const kind = (row.kind as string | null) ?? null;
      const type: "Company" | "Individual" =
        kind === "individual"
          ? "Individual"
          : kind === "company"
            ? "Company"
            : company
              ? "Company"
              : "Individual";

      drafts.push({
        id: row.id as string,
        name: nameOfProvider(kind, company, contact),
        category:
          (company?.industry_type as string | null | undefined) ??
          (row.specialty_capability as string | null) ??
          null,
        outreach: (row.outreach_status as string | null) ?? null,
        type,
        companyId: (row.company_id as string | null) ?? null,
        parentId: null,
      });
    }

    const firmsByCompany = new Map(
      drafts
        .filter((row) => row.type === "Company" && row.companyId)
        .map((row) => [row.companyId as string, row.id]),
    );

    for (const row of drafts) {
      if (row.type !== "Individual" || !row.companyId) continue;
      const firm = firmsByCompany.get(row.companyId);
      if (firm && firm !== row.id) row.parentId = firm;
    }

    for (const row of drafts) {
      if (row.parentId) continue;
      relatedProviders.push({
        id: row.id,
        name: row.name,
        category: row.category,
        outreach: row.outreach,
      });
    }
  }

  const eventsThisWeek: RequestEvent[] = (eventRows ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    startAt: (row.start_at as string | null) ?? null,
  }));

  const namedProviders =
    providerRows.length > 0 ? providerRows.map((row) => row.name) : providers;

  const totals = [...planTasks.values()].reduce(
    (acc, entry) => ({ total: acc.total + entry.total, done: acc.done + entry.done }),
    { total: 0, done: 0 },
  );

  return {
    id: request.id as string,
    title: request.title as string,
    status: (request.status as string) ?? "not_started",
    outcome: (request.desired_outcome as string | null) ?? null,
    urgency: (request.urgency as string | null) ?? null,
    definitionOfDone: (request.definition_of_done as string | null) ?? null,
    targetDate: (request.target_date as string | null) ?? null,
    createdAt: request.created_at as string,
    closedAt: (request.closed_at as string | null) ?? null,
    workSummary: (request.work_summary as string | null) ?? null,
    clientId: (client?.id as string) ?? null,
    clientName: (client?.name as string) ?? null,
    ownerName: names.get(request.owner_user_id as string) ?? null,
    stepDone: totals.done,
    stepTotal: totals.total,
    tasks,
    notes: (noteRows ?? []).map((row) => {
      const authorId = (row.created_by_user_id as string | null) ?? null;
      return {
        id: row.id as string,
        body: row.body as string,
        visibility: (row.visibility as string) ?? "internal",
        authorName: authorId ? names.get(authorId) ?? null : null,
        authorPhoto: authorId ? photos.get(authorId) ?? null : null,
        createdAt: row.created_at as string,
      };
    }),
    documents,
    plans: (planRows ?? []).map((row) => {
      const entry = planTasks.get(row.id as string) ?? { total: 0, done: 0 };
      return {
        id: row.id as string,
        name: row.name as string,
        status: (row.status as string) ?? "not_started",
        targetDate: (row.target_date as string | null) ?? null,
        tasksTotal: entry.total,
        tasksDone: entry.done,
      };
    }),
    people: [
      ...(request.owner_user_id
        ? [{ name: names.get(request.owner_user_id as string) ?? "Owner", role: "Owner" }]
        : []),
      ...(participants ?? [])
        .filter((row) => row.participant_type !== "company")
        .flatMap((row) => {
          const name = names.get(row.participant_id as string);
          if (!name) return [];
          return [{ name, role: (row.role as string) || "Assisting" }];
        }),
    ],
    providers: namedProviders,
    providerRows,
    relatedProviders,
    forms,
    eventsThisWeek,
    outstanding,
    conversations,
  };
}
