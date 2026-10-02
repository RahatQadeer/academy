import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Toast } from "@/whitbyos/components/Toast";
import { RequestTabs } from "@/whitbyos/requests/[id]/components/RequestTabs";
import { OverviewTab } from "@/whitbyos/requests/[id]/components/OverviewTab";
import {
  DocumentsTab,
  FormsTab,
  MessagesTab,
  NotesTab,
  ProvidersTab,
  TasksTab,
  WorkPlansTab,
} from "@/whitbyos/requests/[id]/components/RequestTabViews";
import { CloseRequestDialog } from "@/whitbyos/requests/[id]/components/CloseRequestDialog";
import { EditRequestDialog } from "@/whitbyos/requests/[id]/components/EditRequestDialog";
import { AttachFormDialog } from "@/whitbyos/requests/[id]/components/AttachFormDialog";
import { AddRequestProviderDialog } from "@/whitbyos/requests/[id]/components/AddRequestProviderDialog";
import { UploadDocumentDialog } from "@/whitbyos/documents/components/UploadDocumentDialog";
import { reopenRequest } from "@/whitbyos/requests/actions";
import { getRequestDetail, type RequestTab } from "@/whitbyos/lib/request-detail";
import { listForms } from "@/whitbyos/lib/forms";
import { listProviders } from "@/whitbyos/lib/providers";
import { statusLabel } from "@/whitbyos/lib/format";
import { BackLink } from "@/whitbyos/components/BackLink";

/**
 * Screens 3.3o, 3.3t, 3.3n, 3.3d and 3.3w — one Request across five tabs.
 *
 * The updated export replaced the old single-page Request with this. The plan
 * review and refine screens it used to carry are gone from the design; the code
 * for them stays under requests/[id]/plan, unreachable from here, rather than
 * being deleted while the client is still settling what that flow should be.
 */
export default async function RequestDetailPage({
  requestId,
  tab = "",
  searchParams,
}: {
  requestId: string;
  tab?: RequestTab;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const request = await getRequestDetail(requestId);
  if (!request) notFound();

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const here = `/whitbyos/requests/${requestId}`;
  const closing = one(searchParams?.close) === "1";
  const editing = one(searchParams?.edit) === "1";
  const uploading = one(searchParams?.upload) === "1";
  const attaching = one(searchParams?.attach) === "1";
  const addingProvider = one(searchParams?.add) === "1";
  const error = one(searchParams?.error);
  const closed = Boolean(request.closedAt);

  const attachForms = attaching
    ? await listForms().then((result) =>
        result.ok
          ? result.rows
              .filter((form) => form.visibility === "client_visible")
              .map((form) => ({ id: form.id, title: form.title }))
          : [],
      )
    : [];

  const directoryProviders = addingProvider
    ? await listProviders().then((result) =>
        result.ok ? result.rows.map((row) => ({ id: row.id, name: row.name })) : [],
      )
    : [];

  const documentsClose = `${here}/documents`;
  const formsClose = `${here}/forms`;
  const providersClose = `${here}/providers`;

  return (
    <div className="min-h-full px-10 py-8">
      <BackLink href="/whitbyos/requests" label="Back to Requests" />

      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href="/whitbyos/requests" className="no-underline hover:underline" style={{ color: "inherit" }}>
          Requests
        </Link>
        {" / "}
        <span style={{ color: "var(--ink)" }}>{request.title}</span>
      </div>

      <div
        className="relative mb-5 overflow-hidden rounded-[14px] border"
        style={{
          borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
          background:
            "linear-gradient(105deg, color-mix(in srgb, var(--accent-tint) 55%, var(--surface)) 0%, var(--surface) 58%)",
          boxShadow: "0 1px 2px rgba(31,72,125,.04), 0 18px 40px -28px rgba(31,72,125,.35)",
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: "var(--accent)" }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-[18px] pl-6">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[22px] font-bold tracking-[-0.3px]">{request.title}</h1>
              <Pill tone={closed ? "success" : "info"}>
                {closed
                  ? "Closed"
                  : request.stepTotal > 0
                    ? `${statusLabel(request.status)} · Step ${request.stepDone} of ${request.stepTotal}`
                    : statusLabel(request.status)}
              </Pill>
            </div>
            {request.outcome ? (
              <p
                className="max-w-[640px] text-[13px] leading-[1.5]"
                style={{ color: "var(--text-secondary)" }}
              >
                {request.outcome}
              </p>
            ) : null}
            <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              Client: {request.clientName ?? "None"}
              {request.providerRows.length > 0
                ? ` · ${request.providerRows.length} provider${request.providerRows.length === 1 ? "" : "s"}`
                : null}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2.5">
            <Button unsized
              href="/whitbyos/work-plans/new"
              variant="secondary"
              className="px-4 py-[9px] text-[13.5px]"
            >
              + New Work Plan
            </Button>
            <Button unsized href={`${here}?edit=1`} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Edit
            </Button>
            {closed ? (
              <form action={reopenRequest}>
                <input type="hidden" name="request_id" value={requestId} />
                <SubmitPlain
                  className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium"
                  style={{ background: "var(--surface)", color: "var(--ink)" }}
                >
                  Reopen
                </SubmitPlain>
              </form>
            ) : (
              <Button unsized href={`${here}?close=1`} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
                Close Request
              </Button>
            )}
          </div>
        </div>
      </div>

      <RequestTabs requestId={requestId} active={tab} />

      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {closed && request.workSummary ? (
        <div className="mb-5">
          <Callout tone="success">
            <strong>Work summary.</strong> {request.workSummary}
          </Callout>
        </div>
      ) : null}

      {tab === "tasks" ? (
        <TasksTab request={request} />
      ) : tab === "notes" ? (
        <NotesTab request={request} />
      ) : tab === "documents" ? (
        <DocumentsTab request={request} uploadHref={`${here}/documents?upload=1`} />
      ) : tab === "work-plans" ? (
        <WorkPlansTab request={request} />
      ) : tab === "forms" ? (
        <FormsTab request={request} attachHref={`${here}/forms?attach=1`} />
      ) : tab === "providers" ? (
        <ProvidersTab request={request} addHref={`${here}/providers?add=1`} />
      ) : tab === "messages" ? (
        <MessagesTab request={request} />
      ) : (
        <OverviewTab request={request} />
      )}

      {editing ? (
        <EditRequestDialog
          requestId={requestId}
          closeHref={here}
          error={error}
          values={{
            title: request.title,
            outcome: request.outcome,
            status: request.status,
            urgency: request.urgency,
            targetDate: request.targetDate,
          }}
        />
      ) : null}

      {closing ? (
        <CloseRequestDialog
          requestId={requestId}
          closeHref={here}
          definitionOfDone={request.definitionOfDone}
          openCount={
            request.tasks.filter(
              (task) => !["complete", "completed", "done"].includes(task.status.toLowerCase()),
            ).length
          }
          error={error}
        />
      ) : null}

      {uploading ? (
        <UploadDocumentDialog
          contexts={[
            {
              value: `request:${requestId}`,
              label: request.title,
            },
          ]}
          defaultContext={`request:${requestId}`}
          returnTo={documentsClose}
          closeHref={documentsClose}
          error={error}
        />
      ) : null}

      {attaching ? (
        <AttachFormDialog
          requestId={requestId}
          clientId={request.clientId ?? ""}
          forms={attachForms}
          closeHref={formsClose}
          error={
            request.clientId
              ? error
              : "This Request has no client, so a form cannot be sent yet."
          }
        />
      ) : null}

      {addingProvider ? (
        <AddRequestProviderDialog
          requestId={requestId}
          providers={directoryProviders}
          closeHref={providersClose}
          error={error}
        />
      ) : null}

      {one(searchParams?.closed) ? (
        <Toast
          title="Request closed"
          detail="Its work summary is on the record. Reopen it if something else comes up."
          closeHref={here}
        />
      ) : null}
    </div>
  );
}
