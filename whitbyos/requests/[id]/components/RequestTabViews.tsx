import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { Avatar } from "@/base/components/Avatar";
import { EmptyNote } from "@/whitbyos/components/EmptyNote";
import { NoteForm } from "@/whitbyos/requests/[id]/components/NoteForm";
import { RequestTasksList } from "@/whitbyos/requests/[id]/components/RequestTasksList";
import { RequestNotesList } from "@/whitbyos/requests/[id]/components/RequestNotesList";
import { RequestDocumentsList } from "@/whitbyos/requests/[id]/components/RequestDocumentsList";
import { RequestWorkPlansList } from "@/whitbyos/requests/[id]/components/RequestWorkPlansList";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import type { RequestDetail } from "@/whitbyos/lib/request-detail";
import { submissionLabel, submissionTone } from "@/whitbyos/lib/form-vocab";
import { outreachLabel } from "@/whitbyos/lib/provider-vocab";
import { Button } from "@/base/components/Button";
import {
  attachRequestProvider,
  detachRequestProvider,
} from "@/whitbyos/requests/actions";

/** Screen 3.3t — every task on this Request, open ones first. */
export function TasksTab({ request }: { request: RequestDetail }) {
  if (request.tasks.length === 0) {
    return (
      <EmptyNote>
        No tasks on this Request yet. They arrive with a Work Plan, or can be
        added from Tasks.
      </EmptyNote>
    );
  }

  return <RequestTasksList tasks={request.tasks} />;
}

/** Screen 3.3n — Notes. */
export function NotesTab({ request }: { request: RequestDetail }) {
  return (
    <div className="w-full">
      <NoteForm requestId={request.id} />
      <RequestNotesList notes={request.notes} />
    </div>
  );
}

/** Screen 3.3d — Documents filed against this Request. */
export function DocumentsTab({
  request,
  uploadHref,
}: {
  request: RequestDetail;
  uploadHref: string;
}) {
  const rows = request.documents.filter(
    (document) => !document.request_title || document.request_title === request.title,
  );

  return (
    <div className="w-full">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
            Documents
          </div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Files filed against this Request
          </div>
        </div>
        <Button unsized href={uploadHref} variant="secondary" className="px-3 py-1.5 text-[12.5px]">
          + Upload Document
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyNote>
          Nothing filed against this Request yet. Upload a file here, or link one
          from Documents.
        </EmptyNote>
      ) : (
        <RequestDocumentsList documents={rows} />
      )}
    </div>
  );
}

/** Screen 3.3w — the Work Plans built for this Request. */
export function WorkPlansTab({ request }: { request: RequestDetail }) {
  if (request.plans.length === 0) {
    return (
      <EmptyNote>
        No Work Plan yet. A plan is how the Request becomes Work Streams and
        tasks someone can actually pick up.
      </EmptyNote>
    );
  }

  return <RequestWorkPlansList plans={request.plans} />;
}

/** Screen 3.3f — forms linked to this Request. */
export function FormsTab({
  request,
  attachHref,
}: {
  request: RequestDetail;
  attachHref: string;
}) {
  /*
   * The column set, once, so the heading row and the rows underneath it
   * cannot drift apart.
   *
   * The table was capped at 820px on a page nearly twice that, so every
   * form name was cut mid-word — "What we need from you: UK Visitor visa -
   * family …" — with half the screen empty beside it. These names all begin
   * the same way, so the part that was thrown away is the only part that
   * told them apart. The name column takes what the dates do not need.
   */
  const COLUMNS =
    "[grid-template-columns:minmax(0,3fr)_minmax(132px,auto)_minmax(74px,auto)_minmax(74px,auto)_16px]";

  return (
    <div className="w-full">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold">Forms linked to this Request</div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            What the client was asked for, and whether it has come back
          </div>
        </div>
        <Button unsized href={attachHref} variant="secondary" className="px-3 py-1.5 text-[12.5px]">
          + Attach Form
        </Button>
      </div>

      {request.forms.length === 0 ? (
        <EmptyNote>
          No forms on this Request yet. Attach a Client Visible template to send
          it to the client.
        </EmptyNote>
      ) : (
        <div
          className="overflow-hidden rounded-[12px] border"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <div
            className={`grid ${COLUMNS} items-center gap-3 border-b px-4 py-2.5 text-[11.5px] font-semibold`}
            style={{
              borderColor: "var(--chrome-line)",
              background: "var(--surface-soft)",
              color: "var(--text-tertiary)",
            }}
          >
            <span>Form</span>
            <span>Status</span>
            <span>Sent</span>
            <span>Updated</span>
            <span />
          </div>
          {request.forms.map((form) => (
            <Link
              key={form.id}
              href={`/whitbyos/forms?tab=submissions&review=${form.id}`}
              className={`group grid ${COLUMNS} items-center gap-3 border-b px-4 py-3 no-underline transition-colors last:border-b-0 hover:bg-[var(--surface-soft)]`}
              style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
            >
              <span className="min-w-0 truncate text-[13.5px]" title={form.title}>
                {form.title}
              </span>
              <span>
                <Pill tone={submissionTone(form.status)}>{submissionLabel(form.status)}</Pill>
              </span>
              <span
                className="whitespace-nowrap text-[12.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                {shortDate(form.sentAt)}
              </span>
              <span
                className="whitespace-nowrap text-[12.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {shortDate(form.updatedAt)}
              </span>
              {/* The row opens the submission. Nothing on it said so. */}
              <span
                aria-hidden
                className="text-[13px] transition-transform group-hover:translate-x-0.5"
                style={{ color: "var(--text-disabled)" }}
              >
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Screen 3.3p — providers engaged on this Request. */
export function ProvidersTab({
  request,
  addHref,
}: {
  request: RequestDetail;
  addHref: string;
}) {
  const related = request.relatedProviders;

  return (
    <div className="w-full">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
            Providers engaged on this Request
          </div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            Put forward for review, shortlist, or selection
          </div>
        </div>
        <Button unsized href={addHref} variant="secondary" className="px-3 py-1.5 text-[12.5px]">
          + Add Provider
        </Button>
      </div>

      {request.providerRows.length === 0 ? (
        <div
          className="mb-5 rounded-[12px] border px-5 py-8 text-center text-[13.5px]"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            color: "var(--text-tertiary)",
          }}
        >
          No providers on this Request yet. Add one from the directory
          {related.length > 0 ? ", or engage one of the related providers below" : ""}.
        </div>
      ) : (
        <div
          className="mb-5 overflow-hidden rounded-[12px] border"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <div
            className="grid grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr_auto] border-b px-4 py-2.5 text-[11.5px] font-semibold"
            style={{
              borderColor: "var(--chrome-line)",
              background: "var(--surface-soft)",
              color: "var(--text-tertiary)",
            }}
          >
            <span>Provider</span>
            <span>Category</span>
            <span>Outreach State</span>
            <span>Last Contact</span>
            <span>Next Step</span>
            <span className="w-[88px]" />
          </div>
          {request.providerRows.map((row) => (
            <div
              key={row.optionId}
              className="grid grid-cols-[2fr_1.2fr_1.2fr_1fr_1fr_auto] items-center border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--chrome-line)" }}
            >
              <Link
                href={`/whitbyos/providers/${row.providerId}`}
                className="min-w-0 truncate text-[13.5px] font-medium no-underline"
                style={{ color: "var(--ink)" }}
              >
                {row.name}
              </Link>
              <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                {row.category ?? "—"}
              </span>
              <span>
                <Pill tone="info">{outreachLabel(row.outreach)}</Pill>
              </span>
              <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                {shortDate(row.lastContact)}
              </span>
              <span className="min-w-0 truncate pr-3 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
                {row.nextStep ?? "—"}
              </span>
              <form action={detachRequestProvider} className="ml-3 justify-self-end pl-1">
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="option_id" value={row.optionId} />
                <Button
                  unsized
                  type="submit"
                  variant="secondary"
                  className="px-3 py-1.5 text-[12.5px]"
                >
                  Remove
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}

      {related.length > 0 ? (
        <section>
          <div className="mb-3">
            <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Related providers
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {request.clientName
                ? `Filed to ${request.clientName}, not yet on this Request`
                : "Filed to this client, not yet on this Request"}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {related.map((provider) => (
              <div
                key={provider.id}
                className="flex flex-wrap items-center gap-3 rounded-[12px] border px-4 py-3.5"
                style={{
                  borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                  background: "var(--surface)",
                  boxShadow: "0 1px 2px rgba(31,72,125,.04)",
                }}
              >
                <Link
                  href={`/whitbyos/providers/${provider.id}`}
                  className="min-w-0 flex-1 no-underline"
                  style={{ color: "var(--ink)" }}
                >
                  <span className="block truncate text-[14px] font-semibold">{provider.name}</span>
                  <span
                    className="mt-0.5 block text-[12.5px]"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {provider.category ?? "Provider"}
                    {provider.outreach ? ` · ${outreachLabel(provider.outreach)}` : ""}
                  </span>
                </Link>

                <form action={attachRequestProvider}>
                  <input type="hidden" name="request_id" value={request.id} />
                  <input type="hidden" name="provider_id" value={provider.id} />
                  <Button unsized type="submit" variant="secondary" className="px-3 py-1.5 text-[12.5px]">
                    Add to Request
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The conversations filed under this Request.
 *
 * Add to Request has always written the link; nothing on this side read it, so
 * the answer to "what has actually been said about this" was a screen away and
 * a filter deep. A row per conversation, opening the thread itself — this is a
 * way in, not a second place to read messages.
 */
export function MessagesTab({ request }: { request: RequestDetail }) {
  if (request.conversations.length === 0) {
    return (
      <EmptyNote>
        No conversations are filed under this Request. Open one in Messages and
        use Add to Request, and it will be listed here.
      </EmptyNote>
    );
  }

  return (
    <div
      className="w-full overflow-hidden rounded-[12px] border"
      style={{
        borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
        background: "var(--surface)",
        boxShadow: "0 1px 2px rgba(31,72,125,.04)",
      }}
    >
      {request.conversations.map((thread) => {
        const names = thread.people.map((person) => person.name).join(", ");
        const heading = thread.kind === "group" ? thread.subject : names || thread.subject;
        const group = thread.kind === "group";

        return (
          <Link
            key={thread.id}
            href={`/whitbyos/messages?tab=${thread.kind}&thread=${thread.id}`}
            className="flex items-start gap-3 border-b px-4 py-3.5 no-underline last:border-b-0 transition-colors hover:bg-[var(--surface-soft)]"
            style={{ borderColor: "var(--chrome-line)", color: "var(--ink)" }}
          >
            <span className="mt-px shrink-0">
              {group && !thread.photo ? (
                <GroupMark name={heading} />
              ) : (
                <Avatar
                  name={heading}
                  src={thread.photo ?? undefined}
                  size={30}
                  className="text-[10px]"
                />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="min-w-0 truncate text-[13.5px]"
                  style={{ fontWeight: thread.unread ? 700 : 600 }}
                >
                  {heading}
                </span>
                <span className="shrink-0 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {relativeTime(thread.lastAt)}
                </span>
              </div>

              <p
                className="mt-[3px] truncate text-[12.5px]"
                style={{ color: "var(--text-secondary)", margin: "3px 0 0" }}
              >
                {thread.preview}
              </p>

              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
                  {thread.count === 1 ? "1 message" : `${thread.count} messages`}
                  {group && names ? ` · ${names}` : ""}
                </span>
                {thread.unread ? <Pill tone="info">New</Pill> : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/** A group without its own picture — people icon, not "WC" initials. */
function GroupMark({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full"
      style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
      title={name}
      aria-hidden
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="5.5" r="2.25" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M1.75 12.5c.4-2 1.85-3.1 4.25-3.1s3.85 1.1 4.25 3.1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="11.25" cy="6" r="1.85" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M11 9.55c1.55.15 2.85.95 3.25 2.45"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
