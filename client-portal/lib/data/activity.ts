import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listInvoices } from "./billing";
import { listCalendar } from "./calendar";
import { listDocuments } from "./documents";
import { listForms } from "./forms";
import { listThreads } from "./messages";
import { listRequests } from "./requests";
import { listTasks } from "./tasks";
import { listUpdates } from "./updates";
import { money } from "@/client-portal/lib/format";
import { REQUEST_STATUS } from "@/client-portal/lib/status";
import type { ActivityEntry } from "@/client-portal/types";

/**
 * Recent Activity: what has happened on this account, across every area its
 * reader holds.
 *
 * It used to be published updates and nothing else. A client whose invoice was
 * issued, whose document was shared, whose form was sent back for a correction
 * and whose request was completed saw an empty feed unless somebody had also
 * written a progress update about it — and the Updates screen was already the
 * place progress updates live, so the tab was a second copy of one screen
 * rather than a view across the rest.
 *
 * Every source below is one of the portal's own area-gated readers, which is
 * what makes this safe to assemble: each returns `[]` for a reader who was not
 * granted that area, so the permission is enforced at the read rather than
 * re-implemented here. Nothing is queried twice either — the readers are
 * `cache()`d per request, so Home composing this alongside Action Needed costs
 * one round of queries, not two.
 *
 * It is still not the internal Timeline. SRS 13.2.7 rules out a global
 * client-facing timeline, and everything here is a fact the client was already
 * shown on one of their own screens; this only gathers them into one order.
 */
export async function listActivity(limit = 40): Promise<ActivityEntry[]> {
  const [updates, requests, documents, forms, tasks, invoices, threads, events] =
    await Promise.all([
      listUpdates(),
      listRequests(),
      listDocuments(),
      listForms(),
      listTasks(),
      listInvoices(),
      listThreads(),
      listCalendar(),
    ]);

  const entries: ActivityEntry[] = [];

  for (const update of updates) {
    entries.push({
      id: `update-${update.id}`,
      kind: "update",
      // The headline is the one-line version the professional already wrote,
      // which is exactly what an activity row wants; the body is the full
      // update and reads as a wall of text in a list of forty.
      body: update.headline ?? update.body,
      occurredAt: update.publishedAt,
      requestTitle: update.requestTitle,
      href: update.type === "plans_update" ? "/client-portal/updates?tab=plans" : "/client-portal/updates",
    });
  }

  for (const request of requests) {
    const href = `/client-portal/requests/${request.id}`;
    if (request.closedAt) {
      entries.push({
        id: `request-closed-${request.id}`,
        kind: "request",
        body: `${request.title} was completed.`,
        occurredAt: request.closedAt,
        requestTitle: null,
        href,
      });
      continue;
    }
    /*
     * `updated_at`, said as `updated_at` means it.
     *
     * The row is not a status change — nothing on this side records when a
     * status last moved — so it does not claim to be one. It says the request
     * was worked on and what state that left it in, which is what the column
     * can actually support, and the state goes in the meta line where a
     * status belongs rather than into a sentence asserting a transition.
     */
    entries.push({
      id: `request-${request.id}`,
      kind: "request",
      body: `${request.title} — ${REQUEST_STATUS[request.status].label}`,
      occurredAt: request.updatedAt,
      requestTitle: null,
      href,
    });
  }

  for (const doc of documents) {
    entries.push({
      id: `document-${doc.id}`,
      kind: "document",
      body:
        doc.status === "action_needed"
          ? `${doc.title} needs your attention.`
          : `${doc.title} was shared with you.`,
      occurredAt: doc.sharedAt,
      requestTitle: doc.requestTitle,
      href: "/client-portal/documents",
    });

    // The signing round trip is a second thing that happened to the same
    // document, on its own date — a row shared in March and signed in June is
    // two entries, months apart, not one.
    if (doc.signature?.at && doc.signature.state && doc.signature.state !== "awaiting") {
      entries.push({
        id: `document-sig-${doc.id}`,
        kind: "document",
        body:
          doc.signature.state === "signed"
            ? `${doc.title} was signed.`
            : `A signature was declined on ${doc.title}.`,
        occurredAt: doc.signature.at,
        requestTitle: doc.requestTitle,
        href: "/client-portal/documents",
      });
    }
  }

  for (const form of forms) {
    const href = `/client-portal/forms/${form.id}`;
    if (form.sentAt) {
      entries.push({
        id: `form-sent-${form.id}`,
        kind: "form",
        body: `${form.title} was requested from you.`,
        occurredAt: form.sentAt,
        requestTitle: form.requestTitle,
        href,
      });
    }
    if (form.submittedAt) {
      entries.push({
        id: `form-submitted-${form.id}`,
        kind: "form",
        body: `You submitted ${form.title}.`,
        occurredAt: form.submittedAt,
        requestTitle: form.requestTitle,
        href,
      });
    }
    // Both ways a review can go. "Reviewed" alone would tell somebody whose
    // form came back for a correction that it had been dealt with.
    if (form.reviewedAt) {
      entries.push({
        id: `form-reviewed-${form.id}`,
        kind: "form",
        body:
          form.status === "correction_required"
            ? `${form.title} was sent back for a correction.`
            : `${form.title} was accepted.`,
        occurredAt: form.reviewedAt,
        requestTitle: form.requestTitle,
        href,
      });
    }
  }

  for (const task of tasks) {
    if (!task.completedAt) continue;
    entries.push({
      id: `task-${task.id}`,
      kind: "task",
      body: `${task.title} was marked completed.`,
      occurredAt: task.completedAt,
      requestTitle: task.requestTitle,
      href: task.requestId ? `/client-portal/requests/${task.requestId}?tab=tasks` : null,
    });
  }

  for (const invoice of invoices) {
    entries.push({
      id: `invoice-${invoice.id}`,
      kind: "invoice",
      body: `Invoice ${invoice.number} was issued for ${money(invoice.amountCents)}.`,
      occurredAt: invoice.issuedAt,
      requestTitle: invoice.requestTitle,
      href: "/client-portal/billing",
    });
    if (invoice.paidAt) {
      entries.push({
        id: `invoice-paid-${invoice.id}`,
        kind: "invoice",
        body: `Invoice ${invoice.number} was paid.`,
        occurredAt: invoice.paidAt,
        requestTitle: invoice.requestTitle,
        href: "/client-portal/billing",
      });
    }
  }

  for (const thread of threads) {
    entries.push({
      id: `thread-${thread.id}`,
      kind: "message",
      // `lastMine` is who spoke last, which is the difference between "your
      // team wrote to you" and "you wrote to them" — the same distinction the
      // Messages list draws, said in words here.
      body: thread.lastMine
        ? `You replied in ${thread.subject}.`
        : `New message in ${thread.subject}.`,
      occurredAt: thread.lastMessageAt,
      requestTitle: thread.requestTitle,
      href: `/client-portal/messages?thread=${thread.id}`,
    });
  }

  /*
   * Appointments that have already happened.
   *
   * A calendar row's date is when the meeting *is*, not when it was put in the
   * diary, and nothing on this side records the second one. So a future event
   * cannot honestly be dated in a feed of what has happened — it would sort
   * above everything on a date that has not arrived. Upcoming events have
   * their own panel on Home, which is where a client looks for them anyway.
   */
  for (const event of events) {
    entries.push({
      id: `event-${event.id}`,
      kind: "event",
      body: `${event.title} took place.`,
      occurredAt: event.endAt ?? event.startAt,
      requestTitle: event.requestTitle,
      href: "/client-portal/calendar",
    });
  }

  // One clock for the whole feed, so two rows a millisecond apart cannot land
  // on different sides of "has this happened yet".
  const now = Date.now();

  return entries
    .filter((entry) => {
      const at = Date.parse(entry.occurredAt);
      return Number.isFinite(at) && at <= now;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

/**
 * The reader's own areas, as a count of what the feed is actually drawing
 * from. Home says so under the panel: a feed that looks thin because somebody
 * holds two of the nine areas is not the same as one that is thin because
 * nothing has happened, and the empty state cannot tell them apart on its own.
 */
export async function activitySourceCount(): Promise<number> {
  const ctx = await getPortalContext();
  const sources: (keyof typeof ctx.areas)[] = [
    "updates",
    "requests",
    "documents",
    "forms",
    "billing",
    "messages",
    "calendar",
  ];
  return sources.filter((area) => ctx.areas[area]).length;
}
