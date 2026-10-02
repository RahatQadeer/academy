import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listDocuments } from "./documents";
import { listForms } from "./forms";
import { listTasks } from "./tasks";
import * as fixtures from "@/client-portal/lib/fixtures";
import {
  documentActionLabel,
  formActionLabel,
  formNeedsClient,
} from "@/client-portal/lib/status";
import { dueLabel } from "@/client-portal/lib/format";
import type { ActionItem, PortalArea, PortalDocument } from "@/client-portal/types";

/**
 * The verb in front of a document's title on Action Needed.
 *
 * All four are reachable since whitbyos/036 gave `neededAction` an expiry to
 * read. This used to say "Upload" or "Review" and nothing else, so a document
 * waiting on a signature and one that had run out both read as "Review".
 */
const DOCUMENT_VERB: Record<
  NonNullable<PortalDocument["actionType"]>,
  string
> = {
  review: "Review",
  sign: "Sign",
  upload: "Upload",
  update: "Update",
};

/**
 * The area an Action Needed row belongs to, and therefore the permission that
 * decides whether its owner ever sees it.
 *
 * Tasks, approvals, confirmations and questions all hang off a Request, which
 * is why four of the six point at `requests`: the Portal has no Task screen
 * (SRS 13.2.3), so a Task is only ever reachable through the Request it belongs
 * to, and granting sight of one without the other would produce a row nobody
 * can follow.
 */
const AREA_FOR_KIND: Record<ActionItem["kind"], PortalArea> = {
  form: "forms",
  document: "documents",
  task: "requests",
  approval: "requests",
  confirmation: "requests",
  question: "requests",
};

/**
 * Action Needed is the portal's single work surface. Tasks are deliberately not
 * a nav item (SRS 13.2.3) — client-visible Tasks, approvals, confirmations,
 * forms and uploads all converge here, assembled from the records that carry a
 * pending client action, `whitbyos_tasks` (open/waiting) included.
 */
export async function listActionItems(): Promise<ActionItem[]> {
  const ctx = await getPortalContext();

  // The sample account obeys the same area rules as a live one. Every real
  // source below is gated at its own read, so this list is already correct in
  // live mode; the fixtures bypass those readers entirely and would otherwise
  // put a form on Action Needed for somebody who cannot open Forms — a sample
  // of behaviour the product does not have.
  if (ctx.mode === "demo") {
    return fixtures.ACTION_ITEMS.filter((item) => ctx.areas[AREA_FOR_KIND[item.kind]]);
  }

  const [forms, documents, tasks] = await Promise.all([
    listForms(),
    listDocuments(),
    listTasks(),
  ]);

  // Both states that are waiting on the client, not just the untouched ones.
  // A form the professional sent back for a correction is the most pressing
  // thing on this list — somebody has already read it and is waiting — and it
  // never appeared here at all while `action_required` was one bucket.
  const formActions: ActionItem[] = forms
    .filter((form) => formNeedsClient(form.status))
    .map((form) => ({
      id: `form-${form.id}`,
      kind: "form" as const,
      title:
        form.status === "correction_required"
          ? `Correct: ${form.title}`
          : `Complete: ${form.title}`,
      context: form.requestTitle,
      requestId: form.requestId,
      dueLabel: form.dueLabel,
      href: `/client-portal/forms/${form.id}`,
      ctaLabel: formActionLabel(form.status),
    }));

  const documentActions: ActionItem[] = documents
    .filter((doc) => doc.status === "action_needed")
    .map((doc) => ({
      id: `doc-${doc.id}`,
      kind: "document" as const,
      title: `${doc.actionType ? DOCUMENT_VERB[doc.actionType] : "Review"}: ${doc.title}`,
      context: doc.requestTitle,
      requestId: doc.requestId,
      // An expiring document is on this list *because* of the date, so the
      // date is the one piece of context it cannot leave out.
      dueLabel: doc.expiresAt ? dueLabel(doc.expiresAt, new Date(), ctx.timezone) : null,
      href: "/client-portal/documents?tab=action-needed",
      ctaLabel: documentActionLabel(doc.actionType),
    }));

  const taskActions: ActionItem[] = tasks
    .filter((task) => task.status !== "completed")
    .map((task) => ({
      id: `task-${task.id}`,
      kind: "task" as const,
      taskId: task.id,
      title: task.title,
      // "General" is what Whitby's own Task list calls the ones belonging to a
      // client and to no Request (whitbyos/044). Borrowed rather than invented,
      // so the two sides name the same thing the same way.
      context: task.requestTitle ?? "General",
      requestId: task.requestId,
      dueLabel: task.dueAt,
      href: task.requestId
        ? `/client-portal/requests/${task.requestId}?tab=tasks`
        : null,
      ctaLabel: "View Task",
    }));

  return [...formActions, ...documentActions, ...taskActions];
}
