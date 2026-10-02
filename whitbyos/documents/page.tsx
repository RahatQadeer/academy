import { listRequestOptions } from "@/whitbyos/lib/tasks";
import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { SessionExpired } from "@/base/components/SessionExpired";
import { Pill } from "@/base/components/Pill";
import { cn } from "@/base/lib/cn";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import { DataTable, DataTableCell, type Column } from "@/whitbyos/components/DataTable";
import {
  ArchiveOrDeleteDialog,
  ArchiveOrDeleteLink,
} from "@/whitbyos/components/ArchiveOrDelete";
import { UploadDocumentDialog } from "@/whitbyos/documents/components/UploadDocumentDialog";
import { DocumentDetailDialog } from "@/whitbyos/documents/components/DocumentDetailDialog";
import { UpdateDocumentDialog } from "@/whitbyos/documents/components/DocumentActionDialogs";
import { SignDocumentScreen } from "@/whitbyos/documents/components/SignDocumentScreen";
import {
  archiveDocument,
  resolveDocument,
} from "@/whitbyos/documents/actions";
import {
  getDocument,
  listDocumentContexts,
  listDocuments,
  neededAction,
  type DocumentRow,
} from "@/whitbyos/lib/documents";
import { getOpenClient, getOpenClientId } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { documentStatusLabel, documentStatusTone, documentDownloadHref } from "@/whitbyos/lib/document-vocab";
import { matchesSearch } from "@/whitbyos/lib/search";
import { readSignature, signatureLine } from "@/whitbyos/lib/signing";
import { shortDate } from "@/whitbyos/lib/format";

const LIST = "/whitbyos/documents";

const TABS = [
  { slug: "", label: "All" },
  { slug: "action", label: "Action Needed" },
  { slug: "labels", label: "Labels" },
  { slug: "archived", label: "Archived" },
] as const;

const ALL_COLUMNS: Column[] = [
  { label: "Document", width: "2.2fr" },
  { label: "Linked to", width: "1.6fr" },
  { label: "Labels", width: "1.6fr" },
  { label: "Status", width: "1.1fr" },
  { label: "Updated", width: "1fr" },
];

const ALL_COLUMNS_WITH_REMOVE: Column[] = [...ALL_COLUMNS, { label: "", width: "32px" }];

const ACTION_COLUMNS: Column[] = [
  { label: "Document", width: "2.4fr" },
  { label: "Linked to", width: "1.8fr" },
  { label: "Needs", width: "1.4fr" },
  { label: "Due", width: "1fr" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** How many rows a page of this list is. */
const PAGE = 13;

function listHref(parts: {
  tab?: string;
  client?: string;
  label?: string;
  q?: string;
  extra?: Record<string, string>;
} = {}) {
  const params = new URLSearchParams();
  if (parts.tab) params.set("tab", parts.tab);
  if (parts.client) params.set("client", parts.client);
  if (parts.tab === "labels" && parts.label) params.set("label", parts.label);
  if (parts.q) params.set("q", parts.q);
  for (const [key, value] of Object.entries(parts.extra ?? {})) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${LIST}?${query}` : LIST;
}

/**
 * Screens 12, 12.1 and 12.5 — every document this workspace can reach.
 *
 * `documents` is base's shared table and carries no workspace of its own, so a
 * document is reachable through what it hangs off: this workspace's clients and
 * their requests, or the workspace id itself when it is not linked yet.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const tab = (one(searchParams?.tab) ?? "") as (typeof TABS)[number]["slug"];
  const label = one(searchParams?.label) ?? "";
  const q = (one(searchParams?.q) ?? "").trim();
  /*
   * Whose work this screen is showing is not this screen's question any more.
   * It is chosen once on Workspace Overview and answered the same way
   * everywhere — see `lib/open-client.ts`.
   */
  const client = (await getOpenClientId()) ?? "";
  const showClients = await usesClientWorkspaces();
  const adding = one(searchParams?.new) === "1";
  const signingId = one(searchParams?.sign);
  const updatingId = one(searchParams?.update);
  const openId = one(searchParams?.doc);
  const removeId = one(searchParams?.remove);
  const uploaded = one(searchParams?.uploaded);
  const error = one(searchParams?.error);

  const here = { tab, client, label, q };

  const [result, contexts, openDocument] = await Promise.all([
    listDocuments({ client: client || undefined }),
    adding ? listDocumentContexts() : Promise.resolve([]),
    openId ? getDocument(openId) : Promise.resolve(null),
  ]);

  const href = (slug: string) => listHref({ ...here, tab: slug });

  const rows = result.ok
    ? result.rows.filter((row) => {
        if (tab === "action") return row.status === "action_needed";
        if (tab === "archived") return row.status === "archived";
        if (tab === "labels") return label ? row.labels.includes(label) : true;
        return row.status !== "archived";
      })
        .filter((row) =>
          matchesSearch(q, [
            row.title,
            row.linkedTo,
            ...row.labels,
            documentStatusLabel(row.status),
          ]),
        )
    : [];

  /*
   * Thirteen, then ask for the next thirteen.
   *
   * A workspace's whole filing cabinet is a scroll with no end, and what
   * somebody opens this screen for is at the top of it. The count on the
   * button says what pressing it is worth; `show` rides in the URL beside the
   * tab and the label, so paging keeps whatever the list is narrowed to.
   */
  const asked = Number(one(searchParams?.show));
  const limit = Number.isFinite(asked) && asked > 0 ? asked : PAGE;
  const page = rows.slice(0, limit);
  const rest = rows.length - page.length;
  const moreHref = listHref({ ...here, label, extra: { show: String(limit + PAGE) } });

  const removing =
    removeId && result.ok ? result.rows.find((row) => row.id === removeId) : undefined;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <PageHeader
        title="Documents"
        gap={20}
        size={22}
        action={
          <Button unsized href={listHref({ ...here, extra: { new: "1" } })} variant="primary" className="px-4 py-[9px] text-[13.5px]">
            + Upload Document
          </Button>
        }
      />

      <div className="mb-5 flex gap-6 border-b border-line">
        {TABS.map((item) => {
          const active = item.slug === tab;
          return (
            <Link
              key={item.label}
              href={href(item.slug)}
              className="pb-2.5 text-[13.5px] no-underline"
              style={{
                color: active ? "var(--ink)" : "var(--text-tertiary)",
                fontWeight: active ? 600 : 400,
                borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {result.ok && result.rows.length > 0 ? (
      <FilterBar
        action={LIST}
        searchPlaceholder="Search documents…"
        searchValue={q}
        hidden={{
          tab: tab || undefined,
          label: tab === "labels" && label ? label : undefined,
        }}
      />
      ) : null}

      {tab === "labels" && result.ok && result.labels.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <LabelChip href={listHref({ tab: "labels", client })} active={!label}>
            All labels
          </LabelChip>
          {result.labels.map((name) => (
            <LabelChip
              key={name}
              href={listHref({ tab: "labels", client, label: name })}
              active={label === name}
            >
              {name}
            </LabelChip>
          ))}
        </div>
      ) : null}

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We could not load your Documents. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Documents%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px] text-[14px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px] text-[14px]">
                Try again
              </Button>
            </>
          }
        />
      ) : rows.length === 0 ? (
        q ? (
          <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
            Nothing matches “{q}”.
          </p>
        ) : (
        <StateMessage
          glyph="❐"
          title={emptyTitle(tab, Boolean(client))}
          description={emptyBody(tab, Boolean(client))}
          action={
            client ? (
              <Button unsized href="/whitbyos/workspaces" variant="primary" className="px-5 py-2.5 text-[13.5px]">
                All clients
              </Button>
            ) : tab === "" ? (
              <Button unsized href={listHref({ extra: { new: "1" } })} variant="primary" className="px-5 py-2.5 text-[13.5px]">
                + Upload your first document
              </Button>
            ) : (
              <Button unsized href={LIST} variant="primary" className="px-5 py-2.5 text-[13.5px]">
                See all documents
              </Button>
            )
          }
        />
        )
      ) : tab === "action" ? (
        <>
        <DataTable columns={ACTION_COLUMNS} rowPadding={13}>
          {page.map((row) => (
            <ActionRow key={row.id} document={row} here={here} />
          ))}
        </DataTable>
        <ShowMore rest={rest} href={moreHref} />
        </>
      ) : (
        <>
        <DataTable columns={ALL_COLUMNS_WITH_REMOVE} rowPadding={13}>
          {page.map((row) => (
            <AllRow
              key={row.id}
              document={row}
              here={here}
            />
          ))}
        </DataTable>
        <ShowMore rest={rest} href={moreHref} />
        </>
      )}

      {adding ? (
        <UploadDocumentDialog
          contexts={contexts}
          clientName={showClients ? (await getOpenClient())?.name ?? null : null}
          closeHref={listHref(here)}
          error={error}
          showClients={showClients}
        />
      ) : null}

      {signingId && result.ok ? (
        (() => {
          const document = result.rows.find((row) => row.id === signingId);
          // Only a row that is actually asking for a signature opens the
          // signer; an id in the address bar is not an ask.
          return document && neededAction(document) === "Sign" ? (
            <SignDocumentScreen
              document={document}
              closeHref={listHref({ ...here, tab: "action" })}
              notice={error}
            />
          ) : null;
        })()
      ) : null}

      {updatingId && result.ok ? (
        (() => {
          const document = result.rows.find((row) => row.id === updatingId);
          return document ? (
            <UpdateDocumentDialog
              documentId={document.id}
              title={document.title}
              expires={document.expires_at ? shortDate(document.expires_at) : null}
              closeHref={listHref({ ...here, tab: "action" })}
              error={error}
            />
          ) : null;
        })()
      ) : null}

      {openDocument ? (
        <DocumentDetailDialog
          document={openDocument}
          closeHref={listHref(here)}
          /* Only the open client's Requests: moving paperwork between families
             is not an edit, it is an accident waiting in a dropdown. */
          requests={
            client
              ? (await listRequestOptions())
                  .filter((request) => request.clientId === client)
                  .map((request) => ({ id: request.id, title: request.title }))
              : []
          }
        />
      ) : null}

      {removing ? (
        <ArchiveOrDeleteDialog
          title={`Archive or Delete "${removing.title}"?`}
          lead={
            removing.linkedHref
              ? "This document is linked to a client or request and has version history. Choose what to remove:"
              : "This document is not linked to a client or request yet. Choose what to remove:"
          }
          linked={
            <>
              Linked to this document:{" "}
              <strong style={{ color: "var(--ink)" }}>{removing.linkedTo ?? "Not linked yet"}</strong>
              {removing.version > 1 ? (
                <>
                  {" "}
                  and{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {removing.version - 1} prior version{removing.version - 1 === 1 ? "" : "s"}
                  </strong>
                </>
              ) : null}
              .
            </>
          }
          archiveLabel="Archive this document"
          archiveDetail="Hides it from active views with its full version history intact. Unarchive anytime from Settings → Archive"
          deleteDetail="Removes this document and its full version history. This can't be undone."
          archiveAction={archiveDocument}
          hidden={{ document_id: removing.id, return_to: listHref(here) }}
          closeHref={listHref(here)}
        />
      ) : null}

      {uploaded ? (
        <Toast
          title="Document uploaded"
          detail={`"${uploaded}" is now on file.`}
          closeHref={listHref(here)}
        />
      ) : null}

      {one(searchParams?.signed) === "1" ? (
        <Toast
          title="Signed copy saved"
          detail="The unsigned original is kept in version history."
          closeHref={listHref(here)}
        />
      ) : null}

      {one(searchParams?.archived) === "1" ? (
        <Toast
          title="Document archived"
          detail="It is in Settings → Archive, with its version history intact."
          closeHref={listHref(here)}
        />
      ) : null}

      {error && !adding && !signingId && !updatingId ? (
        <Toast
          title="Couldn't complete that"
          detail={error}
          closeHref={listHref(here)}
          tone="danger"
        />
      ) : null}

      {one(searchParams?.expired) === "1" ? <SessionExpired next="/whitbyos/documents" /> : null}
    </div>
  );
}

function AllRow({
  document,
  here,
}: {
  document: DocumentRow;
  here: { tab: string; client: string; label: string };
}) {
  const signing = signatureLine(readSignature(document), "professional");

  return (
    <div
      className={cn(
        "relative grid items-center border-b border-line px-4 text-[13.5px] last:border-b-0",
      )}
      style={{
        gridTemplateColumns: "var(--cols)",
        paddingBlock: "var(--row-py, 13px)",
        background: document.status === "action_needed" ? "var(--warning-bg)" : undefined,
      }}
    >
      {/* Overlay so the row opens 12.3 without nesting the archive control. */}
      <Link
        href={listHref({ ...here, extra: { doc: document.id } })}
        scroll={false}
        className="absolute inset-0 z-10"
        aria-label={document.title}
      />

      <span className="min-w-0 truncate pr-3" style={{ color: "var(--ink)" }}>
        {document.title}
      </span>

      {document.linkedHref ? (
        <Link
          href={document.linkedHref}
          className="relative z-20 min-w-0 truncate pr-3 no-underline"
          style={{ color: "var(--text-secondary)" }}
        >
          {document.linkedTo ?? "Nothing"}
        </Link>
      ) : (
        <DataTableCell>{document.linkedTo ?? "Nothing"}</DataTableCell>
      )}

      <span className="flex min-w-0 flex-wrap gap-1.5 pr-3">
        {document.labels.length === 0 ? (
          <span style={{ color: "var(--text-tertiary)" }}>None</span>
        ) : (
          document.labels.map((name) => (
            <span
              key={name}
              className="rounded border border-line px-[7px] py-px text-[10.5px]"
              style={{ color: "var(--text-secondary)" }}
            >
              {name}
            </span>
          ))
        )}
      </span>

      <span className="flex flex-wrap items-center gap-1.5">
        <Pill tone={documentStatusTone(document.status)}>
          {documentStatusLabel(document.status)}
        </Pill>
        {/* Where the signing has got to, beside where the document has got to.
            Two different facts, and the row was only ever showing one — so a
            document sent for signature looked the same as one nobody had
            asked anything of. */}
        {signing ? <Pill tone={signing.tone}>{signing.label}</Pill> : null}
      </span>

      <DataTableCell>{shortDate(document.updated_at)}</DataTableCell>

      {document.status === "archived" ? (
        <span />
      ) : (
        <span className="relative z-20 justify-self-end">
          <ArchiveOrDeleteLink
            href={listHref({ ...here, extra: { remove: document.id } })}
            label="Archive or delete document"
          />
        </span>
      )}
    </div>
  );
}

/** 21a — the Needs column is a control, because the row exists to be settled. */
/**
 * 21a colours the button by what it asks for: Review and Upload in accent,
 * Sign in ink because it is the firmest thing asked of anyone, and Update in the warning
 * tone because it is a document running out rather than one waiting.
 */
const ACTION_TONE: Record<string, string> = {
  Review: "var(--accent)",
  Upload: "var(--accent)",
  "Sign": "var(--ink)",
  Update: "var(--warning-fg)",
};

/** 21a's own label for the signing row, which is two controls, not one. */
const ACTION_LABEL: Record<string, string> = {
  "Sign": "Sign",
};

function ActionRow({
  document,
  here,
}: {
  document: DocumentRow;
  here: { tab: string; client: string; label: string };
}) {
  const needs = neededAction(document);
  const signing = needs === "Sign";
  const updating = needs === "Update";
  const actionHere = { ...here, tab: "action" as const };

  return (
    <div
      className="grid items-center border-b border-line px-4 text-[13.5px] last:border-b-0"
      style={{ gridTemplateColumns: "var(--cols)", paddingBlock: "var(--row-py, 13px)" }}
    >
      <Link
        href={listHref({ ...actionHere, extra: { doc: document.id } })}
        scroll={false}
        className="min-w-0 truncate pr-3 no-underline"
        style={{ color: "var(--ink)" }}
      >
        {document.title}
      </Link>

      <DataTableCell>{document.linkedTo ?? "Nothing"}</DataTableCell>

      <span className="flex items-center gap-2">
        {/* 21a puts Download beside Upload Signed Copy, and the pair is the
            point: nobody signs a contract they cannot get hold of first. It
            only appears when there is a file to fetch. */}
        {signing && document.file_url ? (
          <a
            href={documentDownloadHref(document.id)}
            className="inline-block w-fit cursor-pointer whitespace-nowrap rounded-control border border-line-strong px-3 py-1.5 text-[12px] font-medium no-underline"
            style={{ background: "var(--surface)", color: "var(--ink)" }}
          >
            Download
          </a>
        ) : null}

        {signing || updating ? (
          // 21a2 and 21a3 are screens of their own: the signed copy comes back
          // as a file, and replacing an expiring document needs the new one
          // first.
          <Link
            href={listHref({
              ...actionHere,
              extra: { [signing ? "sign" : "update"]: document.id },
            })}
            className="inline-block w-fit whitespace-nowrap rounded-control px-3 py-1.5 text-[12px] font-medium text-white no-underline hover:text-white"
            style={{ background: ACTION_TONE[needs as string] }}
          >
            {ACTION_LABEL[needs as string] ?? needs}
          </Link>
        ) : (
          <form action={resolveDocument}>
            <input type="hidden" name="document_id" value={document.id} />
            <input type="hidden" name="action" value="review" />
            <SubmitPlain
             
              className="w-fit whitespace-nowrap rounded-control px-3 py-1.5 text-[12px] font-medium text-white"
              style={{ background: ACTION_TONE[needs as string] ?? "var(--accent)" }}
            >
              {needs}
            </SubmitPlain>
          </form>
        )}
      </span>

      <DataTableCell>
        {/* What the row is due by: when it runs out, or failing that when it
            took effect, the only other date the row has. */}
        {document.expires_at
          ? shortDate(document.expires_at)
          : document.effective_date
            ? shortDate(document.effective_date)
            : "Not set"}
      </DataTableCell>
    </div>
  );
}

function LabelChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-control border px-2.5 py-1 text-[12.5px] no-underline"
      style={
        active
          ? { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-tint-mid)" }
          : { borderColor: "var(--border)", color: "var(--text-secondary)" }
      }
    >
      {children}
    </Link>
  );
}

function emptyTitle(tab: string, filtered: boolean) {
  if (filtered) return "Nothing in that workspace";
  if (tab === "action") return "Nothing needs your attention";
  if (tab === "archived") return "Nothing archived";
  if (tab === "labels") return "No labelled documents";
  return "No documents yet";
}

function emptyBody(tab: string, filtered: boolean) {
  if (filtered) {
    return "No document belongs to this workspace. Choose All clients on Workspace Overview to see the rest.";
  }
  if (tab === "action") return "Documents waiting on a review or a signature appear here.";
  if (tab === "archived") return "Documents you archive stay here rather than being deleted.";
  if (tab === "labels") return "Add labels when you upload a document to group them here.";
  return "Agreements, confirmations, letters and briefs, filed against the request they belong to, so they can be found from the work.";
}

/**
 * The rest of the list, on request.
 *
 * Draws nothing when there is no rest, so the foot of a short list is the end
 * of the list rather than a dead control.
 */
function ShowMore({ rest, href }: { rest: number; href: string }) {
  if (rest <= 0) return null;

  return (
    <div className="mt-4 flex justify-center">
      <Link
        href={href}
        className="rounded-control border px-4 py-[8px] text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
        style={{
          borderColor: "var(--border-strong)",
          background: "var(--surface)",
          color: "var(--ink)",
        }}
      >
        Show {Math.min(rest, PAGE)} more
        <span style={{ color: "var(--text-quiet)" }}> · {rest} left</span>
      </Link>
    </div>
  );
}
