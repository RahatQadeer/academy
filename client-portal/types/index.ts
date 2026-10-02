// Client-scoped views of the shapes WhitbyOS owns.
// These are deliberately thin projections of the `whitbyos_*` records — never a
// second definition of them. Anything internal (notes, considerations, provider
// scoring, risks, any workplan nobody shared) is absent by design, not by
// filtering at render time. A Work Plan reaches this side only once the
// professional shares it, and only as the fixed projection `PortalPlan` names.

export type RequestStatus =
  | "running"
  | "approval"
  | "waiting"
  | "completed"
  | "draft";

export type PortalRequest = {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  /**
   * `whitbyos_requests.urgency` (whitbyos/010) — critical, high, medium or low,
   * as the check constraint allows. The professional's own word for how
   * pressing this is; `urgencyView` in `lib/vocab.ts` decides when it is worth
   * drawing.
   */
  urgency: string | null;
  /**
   * `whitbyos_requests.health` (whitbyos/010) — on_track, needs_attention or
   * at_risk. Distinct from `status`: status is what the work is doing, health
   * is whether it is going well, and a request can be Running and At risk at
   * the same time.
   */
  health: string | null;
  /** `target_date` — the date the work is aiming at, not a deadline it is held to. */
  targetDate: string | null;
  nextStep: string | null;
  waitingOn: string | null;
  updatedAt: string;
  closedAt: string | null;
  /**
   * Percent complete, counted from the client-visible Tasks on this Request —
   * not from the internal Work Plan, whose Workstreams and task counts the
   * client is not shown. It used to be the constant 0, or 100 once closed, so
   * every open request drew an empty bar however far along it was.
   */
  progress: number;
  ownerName: string | null;
  /**
   * The closing Work Summary (SRS 6.16.2), present only once the professional
   * has approved it for sharing. Null on every open request, and null on a
   * closed one whose summary has not been released — see
   * `WORK_SUMMARY_IS_SHAREABLE` in `lib/data/requests.ts`.
   */
  workSummary: string | null;
};

export type ProgressUpdate = {
  id: string;
  requestId: string | null;
  requestTitle: string | null;
  /**
   * `whitbyos_updates.headline` (whitbyos/026) — the line the professional
   * actually wrote as the title. `postUpdate` refuses to save without one
   * ("Give the update a headline."), so on anything published since that
   * migration this is the real title; null only on rows that predate it, where
   * the feed falls back to the label it used to synthesize for every row.
   */
  headline: string | null;
  /**
   * `whitbyos_updates.category` (whitbyos/026) — one of UPDATE_CATEGORIES:
   * General, Milestone, Deadline, Blocker, Decision Needed.
   */
  category: string | null;
  /**
   * `whitbyos_updates.urgent` (whitbyos/026) — the professional ticked "urgent"
   * when posting. Distinct from a Deadline category: urgent is about how fast
   * this needs reading, the category is about what it is.
   */
  urgent: boolean;
  body: string;
  authorName: string;
  publishedAt: string;
  type: "progress_update" | "plans_update";
  needsFollowUp: boolean;
};

export type ActionKind =
  | "form"
  | "document"
  | "approval"
  | "confirmation"
  | "question"
  | "task";

export type ActionItem = {
  id: string;
  kind: ActionKind;
  title: string;
  context: string | null;
  /**
   * The Request this action belongs to, or null for one named straight to the
   * client account. Carried alongside `context` because `context` is a title
   * meant for reading, and a Request's detail screen needs to select its own
   * actions by identity — two requests may share a title, and a title-matched
   * filter silently attributed one request's work to another.
   */
  requestId: string | null;
  dueLabel: string | null;
  /**
   * Where the action is carried out, or null when there is nowhere to go.
   *
   * A Task named straight to the client account rather than to a Request
   * (whitbyos/044) has no detail screen to open — the Portal has no Tasks
   * section, and there is no Request to show it on. The row is the whole of
   * the task, so it renders without a button rather than with one that leads
   * back to the list it is already in.
   */
  href: string | null;
  ctaLabel: string;
  /**
   * The `whitbyos_tasks` row behind a `task` item, so the row can carry the
   * client's own Mark complete (client-portal/020). Null on every other kind:
   * a form is finished by filling it in and a document by reviewing it, and
   * neither is something a tick can close.
   *
   * `id` cannot stand in for it — these ids are namespaced per kind
   * (`task-…`, `form-…`) so that two kinds cannot collide in one list.
   */
  taskId?: string | null;
};

/**
 * What a Recent Activity row is about, and therefore which mark it draws and
 * which area had to be granted for it to exist at all.
 *
 * A real field rather than a guess. The feed used to be published updates and
 * nothing else, and its component told the four kinds apart by searching the
 * sentence for the words "completed", "replied" and "shared" — which is fine
 * for copy it wrote itself and wrong the moment a professional's own headline
 * happens to contain one of them.
 */
export type ActivityKind =
  | "update"
  | "request"
  | "document"
  | "form"
  | "message"
  | "invoice"
  | "event"
  | "task";

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  body: string;
  occurredAt: string;
  requestTitle: string | null;
  /** Where the row goes when it is opened. Null for something with no screen. */
  href: string | null;
};

/**
 * The three `whitbyos/lib/calendar-vocab.ts` offers. `travel` and `deadline`
 * are kept because rows written before that vocabulary settled still carry
 * them — nothing writes either any more, and neither gets its own tab.
 */
export type CalendarKind =
  | "appointment"
  | "meeting"
  | "key_date"
  | "travel"
  | "deadline";

export type CalendarItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  kind: CalendarKind;
  requestId: string | null;
  requestTitle: string | null;
  location: string | null;
  /**
   * Who else is in it, as the firm typed them — a comma-separated line, which
   * is what Whitby stores (`whitbyos_calendar_events.attendees`) because a
   * meeting can have a registrar in it who is in none of Whitby's lists. The
   * client's own connected calendar fills it the same way, minus themselves.
   *
   * Shown because the event was shared with them: whoever is coming to a
   * meeting a client is in is part of the meeting, not a fact about the firm.
   */
  attendees: string | null;
  /**
   * An event with no time of its own — a Google all-day entry lands in the row
   * as midnight to midnight, and rendering its `end_at` said "12:00 AM – 12:00
   * AM". Derived exactly as `whitbyos/lib/calendar.ts` derives it, from the
   * shape of the row rather than from a column that could disagree with it.
   */
  allDay: boolean;
  /**
   * `google_calendar` / `outlook_calendar` where the event was synced in
   * (whitbyos/033), null where it was created in Whitby. The client is told
   * which, because a time that came from a calendar can move without anyone
   * here touching it.
   */
  externalCalendar: string | null;
  /**
   * Present on an event from the client's own connected calendar
   * (client-portal/018) rather than one the team shared. Private to this
   * person, tied to no Request, and edited only in the calendar it came from.
   */
  personal?: {
    /** The event in Google Calendar, where it can actually be changed. */
    href: string | null;
    declined: boolean;
  };
};

export type MessageThread = {
  id: string;
  subject: string;
  /**
   * What Whitby calls this conversation (`whitbyos_message_threads.kind`), not
   * what the portal would infer from how many people are on it. A group of two
   * is still a group, and a direct conversation with a second professional
   * added to it is still direct.
   */
  kind: "direct" | "group";
  requestId: string | null;
  requestTitle: string | null;
  lastMessageAt: string;
  unread: boolean;
  /**
   * Everyone on the conversation except the reader — professionals, providers,
   * and the account's other members. The reader is added as "You" by the view,
   * so it always reads last.
   */
  participants: string[];
  preview: string;
  locked: boolean;
  /**
   * When everyone else on the thread had last opened it — the read tick on the
   * client's own messages.
   *
   * The earliest of them, not the latest: a message is read when it has been
   * read by everyone it went to, so one professional who has not opened the
   * thread holds the whole thing at two grey ticks. Anyone who has never opened
   * it makes this null rather than "a long time ago". Same rule
   * `whitbyos/lib/messages.ts` applies on the other side.
   */
  othersReadAt: string | null;
  /**
   * Whether the last thing said was the reader's own — the row carries a tick
   * only then, the way `PreviewMark` in `whitbyos/messages/page.tsx` draws it.
   * A tick on somebody else's message would be answering a question nobody
   * asked.
   */
  lastMine: boolean;
  /** The one other person's photo, where a conversation is with one person. */
  counterpartyPhoto: string | null;
};

export type PortalMessage = {
  id: string;
  threadId: string;
  body: string;
  authorName: string;
  /**
   * Their photo, where they have one. A professional's comes through
   * `portal_thread_people`; the reader's own is signed out of the bucket the
   * portal's own Profile screen writes it to. Initials are the fallback.
   */
  authorPhoto: string | null;
  /**
   * Written by the reader themselves, which is what decides the side and the
   * colour of the bubble. Not "is on the client side": the account's other
   * members write here too, and their messages are somebody else's.
   */
  authorIsMe: boolean;
  sentAt: string;
  /**
   * When it reached the other side, written by their own browser
   * (`whitbyos_messages.delivered_at`, whitbyos/035). The middle tick: arrived,
   * but not opened. Null on anything that has never reached anyone — and on
   * everything, until whitbyos/035 is applied.
   */
  deliveredAt: string | null;
  /** A membership change — drawn centred, not as a bubble. */
  system?: boolean;
};

export type TaskStatus = "open" | "waiting" | "completed";

/**
 * A `whitbyos_tasks` row with `visibility = 'client_visible'` on a Request the
 * client can see. No `ownerName` — same reason `PortalRequest.ownerName` is
 * always null: `owner_user_id` points at base `users`, which is unreadable from
 * this side (`password_hash`, `phone`, `email`, `oauth_id` on every row).
 */
export type PortalTask = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string | null;
  dueAt: string | null;
  waitingOn: string | null;
  nextAction: string | null;
  requestId: string | null;
  requestTitle: string | null;
  updatedAt: string;
  /**
   * When the task was actually finished (`whitbyos_tasks.completed_at`,
   * whitbyos/037). `updated_at` is not the same thing — a task finished in
   * March and edited in May reports May — so a completed row says when it was
   * done rather than when it was last touched.
   *
   * Null on anything still open, and on tasks completed before whitbyos/037
   * shipped: that migration is deliberately not backfilled, because the only
   * candidate date is exactly the wrong answer the column exists to avoid.
   */
  completedAt: string | null;
};

/**
 * A task inside a Work Plan the professional shared (client-portal/014).
 *
 * Every task in a shared, visible Work Stream — not only the client-visible
 * ones — because sharing a plan shares its work. What stays internal is decided
 * by `portal_request_plans()`, not by this type: no priority, no next action,
 * no checklist, no dependency, and never what a task is waiting on.
 */
export type PortalPlanTask = {
  id: string;
  title: string;
  /** `whitbyos_tasks.status`, as the professional wrote it. */
  status: string;
  /** whitbyos/012 — an approval is the Timeline's diamond. */
  kind: "auto" | "approval" | "manual";
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  /** Whether it is waiting on something — never on what. */
  waiting: boolean;
  /** The team member who owns it: a display name, no photo, no email. */
  ownerName: string | null;
};

export type PortalPlanStream = {
  id: string;
  name: string;
  purpose: string | null;
  /** `whitbyos_workstream_status`, unmapped, so both sides say the same word. */
  status: string;
  kind: "auto" | "approval" | "manual";
  /** whitbyos/007 — held up, which Whitby draws as Blocked. */
  blocked: boolean;
  /** yyyy-mm-dd. */
  targetDate: string | null;
  createdAt: string | null;
  ownerName: string | null;
  tasks: PortalPlanTask[];
};

/**
 * A Work Plan shared on WP.17v, as `portal_request_plans()` returns it.
 * Considerations, dependencies, providers, worksheets, versions and the source
 * Playbook are not in that function, so they are not here either.
 */
export type PortalPlan = {
  id: string;
  requestId: string;
  name: string;
  desiredOutcome: string | null;
  status: string;
  urgency: string | null;
  health: string | null;
  /** yyyy-mm-dd. */
  startDate: string | null;
  /** yyyy-mm-dd. */
  targetDate: string | null;
  createdAt: string | null;
  updatedAt: string;
  sharedAt: string | null;
  ownerName: string | null;
  streams: PortalPlanStream[];
};

/** A note the professional ticked Visible to the client (3.3n). */
export type PortalNote = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
};

/** One name on a Request and what they are to it — 3.3o's Contacts. */
export type PortalRequestPerson = { name: string; role: string };

/**
 * The parts of Whitby's Request screens a client may see that no table of
 * theirs holds, from `portal_request_detail()` (client-portal/014).
 */
export type PortalRequestDetail = {
  createdAt: string | null;
  ownerName: string | null;
  team: PortalRequestPerson[];
  notes: PortalNote[];
  /** Owner names for this Request's client-visible tasks, by task id. */
  taskOwners: Record<string, string>;
};

/**
 * `whitbyos_form_submissions.status`, in full — the six values of
 * `SUBMISSION_STATUS` in `whitbyos/lib/form-vocab.ts`, which that file calls
 * "the vocabulary the product agrees on".
 *
 * The portal used to fold these into three buckets of its own —
 * action_required / in_progress / submitted — and the fold lost the answers to
 * the questions a client most wants to ask. `accepted` and `submitted` both
 * read as "Submitted", so nobody could tell work that was finished from work
 * still sitting with their team; and `correction_required` fell in with
 * "not started", so a form the professional had sent back with a note looked
 * identical to one nobody had opened yet.
 *
 * These are the professional's own values, unmapped. Both sides now describe
 * one submission with one word.
 *
 * `needs_review` is carried even though no code path writes it today: it is in
 * the agreed vocabulary, the professional's Submissions screen draws it, and a
 * status the portal does not recognise would fall back to the wrong thing the
 * moment somebody sets it.
 */
export type FormStatus =
  | "awaiting"
  | "draft"
  | "submitted"
  | "needs_review"
  | "accepted"
  | "correction_required";

/**
 * The seven types the Form Builder can write, verbatim from
 * `whitbyos/lib/form-vocab.ts`'s `FIELD_TYPES`.
 *
 * This used to be the portal's own list — text, textarea, date, number, select
 * — which shared exactly one value (`date`) with the vocabulary the builder
 * actually writes. Every other field fell through `normaliseType`'s fallback
 * and rendered as a single-line text box: a Yes/No question, a checklist and a
 * file upload all drawn as the same empty input.
 */
export type PortalFormFieldType =
  | "short"
  | "long"
  | "choice"
  | "checklist"
  | "date"
  | "file"
  | "boolean";

export type PortalFormField = {
  /**
   * The builder writes `id` (see `saveForm` in `whitbyos/forms/actions.ts`),
   * and that is the key a response is stored under in the `responses` jsonb.
   * Named `key` here because that is what it is to the portal — the identity a
   * field's answer hangs off — but it is read from `id`, not from a `key`
   * property that has never existed on either side.
   */
  key: string;
  label: string;
  type: PortalFormFieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  /**
   * The heading this field sits under. Fields carrying the same one are drawn
   * together beneath it; a field with none stands on its own, which is what
   * every form written in the builder does. See `FormField.section`.
   */
  section?: string;
  /** One line under the section's heading. See `FormField.sectionBlurb`. */
  sectionBlurb?: string;
  /** Why it is being asked, drawn under the question. */
  help?: string;
};

export type PortalForm = {
  id: string;
  title: string;
  description: string | null;
  status: FormStatus;
  /**
   * `whitbyos_forms.category` (whitbyos/027) — one of Onboarding, Providers,
   * Confirmations, Travel, Other, or null for a form filed under none.
   */
  category: string | null;
  requestId: string | null;
  requestTitle: string | null;
  requestedByName: string | null;
  dueLabel: string | null;
  /** `sent_at` (whitbyos/048) — when the professional sent it, not when it was made. */
  sentAt: string | null;
  submittedAt: string | null;
  /**
   * `reviewed_at` (whitbyos/027) — when the professional decided on the
   * answers, whichever way they decided. Set by `reviewSubmission` on both
   * Accept and Ask for a correction, and cleared when the client resubmits,
   * because the decision belonged to the answers that have just been replaced.
   */
  reviewedAt: string | null;
  /**
   * What the professional said needs correcting (`correction_note`). Present
   * only while the status is `correction_required` — accepting clears it.
   */
  correctionNote: string | null;
  /**
   * The specific answers the professional sent back (whitbyos/081).
   *
   * A correction used to reopen the whole form, so the note was the only thing
   * saying which part was wrong. These are the ones to fix; everything else
   * they accepted stays accepted and stays read-only.
   */
  correctionFields: string[];
  fields: PortalFormField[];
  /**
   * Answers, keyed by field id. A checklist stores its ticked options as one
   * newline-joined string rather than an array, so the column stays
   * `Record<string, string>` and every existing reader keeps working.
   */
  responses: Record<string, string>;
  /**
   * The answers the professional has accepted (whitbyos/080), keyed the same
   * way and compared by value.
   *
   * A settled answer is one nobody is waiting on any more, so the form stops
   * offering to replace it: re-uploading over something already accepted puts
   * a file on the record that the team has not seen and cannot tell apart from
   * the one they signed off.
   */
  acceptedResponses: Record<string, string>;
};

export type PortalDocumentStatus =
  | "current"
  | "action_needed"
  | "completed"
  | "archived";

export type PortalDocument = {
  id: string;
  title: string;
  status: PortalDocumentStatus;
  /**
   * What an `action_needed` document is asking for, derived exactly as
   * `neededAction` in `whitbyos/lib/documents.ts` derives it so the client and
   * the professional are never told two different things about one row.
   */
  actionType: "review" | "sign" | "upload" | "update" | null;
  /**
   * The signing round trip (whitbyos/072), read through
   * `whitbyos/lib/signing.ts` so the client and the professional cannot be
   * looking at one document and reading two different states off it.
   */
  signature?: {
    requiredFrom: "client" | "professional" | null;
    state: "awaiting" | "signed" | "declined" | null;
    note: string | null;
    at: string | null;
  };
  /**
   * `documents.expires_at` (whitbyos/036) — the date it stops being good, and
   * the whole reason a row asks to be Updated. Null on anything that does not
   * run out.
   */
  expiresAt: string | null;
  labels: string[];
  /** `context_id` when `context_type` is "request" — null on a client-level document. */
  requestId: string | null;
  requestTitle: string | null;
  sharedByName: string | null;
  sharedAt: string;
  version: number;
  fileUrl: string | null;
  sizeLabel: string | null;
};

export type InvoiceStatus = "paid" | "due" | "overdue" | "scheduled";

export type PortalInvoice = {
  id: string;
  number: string;
  description: string | null;
  amountCents: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  requestTitle: string | null;
};

export type BillingSummary = {
  outstandingCents: number;
  paidThisYearCents: number;
  nextDueAt: string | null;
  currency: string;
};

/**
 * The four services a client connects for themselves — the Calendar & Email
 * group of Whitby's Integrations (`whitbyos/lib/integrations.ts`), connected to
 * the person rather than the workspace (client-portal/018).
 *
 * The rest of Whitby's list — Drive, Slack, QuickBooks, Stripe — are the
 * practice's own tools and are not offered to a client.
 */
export type IntegrationKey =
  | "gmail"
  | "google_calendar"
  | "outlook_mail"
  | "outlook_calendar";

/**
 * One of the client's own connections, as Integrations draws it.
 *
 * The same four states Whitby's `IntegrationRow` carries, minus `available`:
 * a client's row that has never been connected is simply `disconnected`.
 * `connectable` is whether this deployment holds the provider's app
 * credentials, which decides whether Connect starts a sign-in or explains why
 * it cannot.
 */
export type PortalIntegration = {
  key: IntegrationKey;
  name: string;
  group: "Email" | "Calendar";
  /** What connecting it does for this person, shown while it is not connected. */
  purpose: string;
  status: "connected" | "needs_attention" | "disconnected";
  connectedAccount: string | null;
  lastSyncAt: string | null;
  errorState: string | null;
  syncSettings: Record<string, boolean>;
  connectable: boolean;
};

export type PortalPersonRole =
  | "primary_member"
  | "additional_member"
  | "authorized_user"
  | "dependent";

/**
 * The nine areas of the portal a membership can be granted separately.
 *
 * The keys are `whitbyos_client_members.permissions`' own (whitbyos/025), so
 * one word means the same thing in the professional's approval screen and here.
 * See `client-portal/lib/access.ts` for how a stored object becomes an
 * `AreaAccess`, including the three keys 2.1.2.1 cannot tick yet.
 *
 * `integrations` and `people` are areas like the rest of them. They were left
 * out while the nav treated both as belonging to everybody with a login, which
 * meant a member granted Requests alone still had the Integrations screen and
 * the account roster — two things nobody had decided to give them.
 */
export type PortalArea =
  | "requests"
  | "messages"
  | "calendar"
  | "documents"
  | "forms"
  | "updates"
  | "billing"
  | "integrations"
  | "people";

export type AreaAccess = Record<PortalArea, boolean>;

export type PortalPerson = {
  id: string;
  /** The contact behind the membership, so a row can identify the reader. */
  contactId: string | null;
  name: string;
  email: string | null;
  role: PortalPersonRole;
  relationship: string | null;
  /**
   * Their own photo, signed. Null for somebody who has never added one — the
   * row falls back to initials, which is a fallback and not the default.
   */
  photoUrl: string | null;
  portalAccess: boolean;
  status: "active" | "pending" | "expired" | "revoked" | "declined";
  scopeSummary: string | null;
  /** Which of the nine areas this person may reach. */
  areas: AreaAccess;
  /** They may read what they are granted, and write nothing. */
  viewOnly: boolean;
  /**
   * Nothing was recorded against this membership, so the areas above are the
   * access it already had rather than a choice anyone made. Screens say so
   * instead of drawing seven ticks the professional never put there.
   */
  areasInherited: boolean;
};

/**
 * One completed round of the correction loop: the professional asked for
 * something, and the client answered it.
 *
 * Kept in `client_portal_form_corrections` (client-portal/010) rather than on
 * the submission, which holds only the correction currently outstanding — see
 * `listCorrectionRounds`.
 */
export type CorrectionRound = {
  id: string;
  /** What was asked for. Null when a correction was asked for without a note. */
  note: string | null;
  /** `reviewed_at` as it stood when the ask was made. */
  askedAt: string | null;
  answeredAt: string;
};

export type AccessRequest = {
  id: string;
  personName: string;
  personEmail: string;
  relationship: string | null;
  requestedRole: string | null;
  /**
   * The areas the client asked for. Empty when the request predates
   * `client-portal/009`, or when they named a role and left the areas alone.
   */
  requestedAreas: PortalArea[];
  reason: string | null;
  status:
    | "pending"
    | "approved_as_requested"
    | "approved_edited"
    | "declined";
  createdAt: string;
  reviewedAt: string | null;
};

// What the professional has enabled for this client account. The portal can
// never offer a capability that is false here — SRS 13.14.7.
export type AccountCapabilities = {
  additionalMembersAllowed: boolean;
  /** NULL when the professional has set no ceiling — see `getPortalContext`. */
  maxAdditionalMembers: number | null;
  authorizedUsersAllowed: boolean;
  /** NULL when the professional has set no ceiling. */
  maxAuthorizedUsers: number | null;
  mayRequestAccess: boolean;
  mayInviteDirectly: boolean;
  mayAddToRequest: boolean;
  mayAddToConversation: boolean;
};

export const NOTIFICATION_EVENTS = [
  "new_message",
  "progress_update",
  "action_needed",
  "form_requested",
  "document_shared",
  "approval_requested",
  "calendar_change",
  "request_status_change",
  "invoice_payment_event",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type NotificationChannel = "email" | "sms" | "in_app";

export type NotificationPref = {
  event: NotificationEvent;
  channel: NotificationChannel;
  enabled: boolean;
};
