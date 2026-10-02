import type {
  InvoiceStatus,
  PortalDocumentStatus,
  FormStatus,
  RequestStatus,
  TaskStatus,
} from "@/client-portal/types";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export type StatusView = { label: string; tone: Tone };

export const REQUEST_STATUS: Record<RequestStatus, StatusView> = {
  running: { label: "Running", tone: "info" },
  approval: { label: "Approval", tone: "warning" },
  waiting: { label: "Waiting", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  draft: { label: "Draft", tone: "neutral" },
};

/**
 * The six submission states, told from the client's side of them.
 *
 * The words are the professional's wherever the professional's word is also
 * true for the client — Submitted, Accepted, Correction Required all describe
 * the same fact to both people, and changing them here would put the two sides
 * of one submission into different languages.
 *
 * Two are re-voiced, because `SUBMISSION_STATUS` names them from the
 * professional's inbox rather than the client's: "Awaiting Response" means
 * *this one is yours to answer*, and "Draft" means the client started and
 * stopped. Neither changes what the state is, only who is being addressed.
 *
 * Tones carry the same reading as the professional's: the two states that put
 * the ball in the client's court are the two that are not neutral.
 */
export const FORM_STATUS: Record<FormStatus, StatusView> = {
  awaiting: { label: "Awaiting your response", tone: "warning" },
  draft: { label: "In progress", tone: "info" },
  submitted: { label: "Submitted", tone: "accent" },
  needs_review: { label: "In review", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  correction_required: { label: "Correction requested", tone: "danger" },
};

/**
 * Whether the client can still type into it.
 *
 * `correction_required` is editable and that is the whole point of the state:
 * the professional has read the answers, asked for something to change, and is
 * waiting for the same submission back. A read-only correction request would
 * be a note the client can see and cannot act on.
 */
export function formIsEditable(status: FormStatus): boolean {
  return status === "awaiting" || status === "draft" || status === "correction_required";
}

/** Whether it is on the client to do something — drives Action Needed and the counts. */
export function formNeedsClient(status: FormStatus): boolean {
  return status === "awaiting" || status === "correction_required";
}

/** The button on a form's row, which is a different sentence in each state. */
export function formActionLabel(status: FormStatus): string {
  switch (status) {
    case "correction_required":
      return "Correct & Resubmit";
    case "draft":
      return "Continue";
    case "awaiting":
      return "Complete Form";
    default:
      return "View";
  }
}

export const TASK_STATUS: Record<TaskStatus, StatusView> = {
  open: { label: "Open", tone: "info" },
  waiting: { label: "Waiting", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
};

export const DOCUMENT_STATUS: Record<PortalDocumentStatus, StatusView> = {
  current: { label: "Current", tone: "neutral" },
  action_needed: { label: "Action needed", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

export const INVOICE_STATUS: Record<InvoiceStatus, StatusView> = {
  paid: { label: "Paid", tone: "success" },
  due: { label: "Due", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  scheduled: { label: "Scheduled", tone: "neutral" },
};

const DOCUMENT_ACTION_LABEL = {
  review: "Review Document",
  sign: "Sign",
  upload: "Upload Document",
  update: "Update Document",
} as const;

export function documentActionLabel(
  action: keyof typeof DOCUMENT_ACTION_LABEL | null,
): string {
  return action ? DOCUMENT_ACTION_LABEL[action] : "Open";
}

/**
 * Maps the `whitbyos_requests.status` value the professional side writes onto the
 * four buckets the client sees. Anything unrecognised reads as Running rather
 * than leaking an internal state name into the portal.
 *
 * The professional's own four are in `whitbyos/lib/request-status.ts`:
 * `not_started`, `running`, `waiting_on_client`, `completed`, with `open` as
 * the older spelling of the first. All five are named here.
 *
 * `waiting_on_client` matters most. It is the professional saying the work has
 * stopped and the client is why, so falling through to Running told the client
 * everything was in hand at the one moment it was not — and put the request in
 * the Active tab rather than Waiting. WhitbyOS's own Reports read it the same
 * way this now does.
 *
 * `not_started` and `open` stay Running. The portal has no bucket for work the
 * professional has not picked up, and Running is what it means from the
 * client's side: submitted, accepted, theirs to do.
 */
export function toClientRequestStatus(
  raw: string | null,
  closedAt: string | null,
): RequestStatus {
  if (closedAt) return "completed";
  switch (raw) {
    case "completed":
    case "closed":
    case "complete":
      return "completed";
    case "awaiting_approval":
    case "approval":
    case "decision_needed":
      return "approval";
    case "waiting_on_client":
    case "waiting":
    case "blocked":
    case "on_hold":
    case "paused":
      return "waiting";
    case "draft":
      return "draft";
    case "not_started":
    case "open":
    default:
      return "running";
  }
}

export const REQUEST_TABS = {
  all: "All Requests",
  active: "Active",
  waiting: "Waiting",
  completed: "Completed",
} as const;

export type RequestTab = keyof typeof REQUEST_TABS;

export function matchesRequestTab(status: RequestStatus, tab: RequestTab) {
  if (tab === "all") return true;
  if (tab === "active") return status === "running" || status === "approval";
  if (tab === "waiting") return status === "waiting";
  return status === "completed";
}
