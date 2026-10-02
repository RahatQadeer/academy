import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import {
  DraftUpdateDialog,
  PlansUpdateDialog,
} from "@/whitbyos/updates/components/UpdateDialogs";
import { listUpdates, type UpdateRow } from "@/whitbyos/lib/updates";
import { matchesSearch } from "@/whitbyos/lib/search";
import { listRequestOptions } from "@/whitbyos/lib/tasks";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { statusLabel, statusTone } from "@/whitbyos/lib/update-vocab";
import { shortDate } from "@/whitbyos/lib/format";

const LIST = "/whitbyos/updates";

const PLAN_COLUMNS: Column[] = [
  { label: "Plan / Update", width: "3fr" },
  { label: "Client", width: "1.4fr" },
  { label: "Date", width: "1fr" },
  { label: "Status", width: "1.2fr" },
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screens 10 and 10.2, with 10.1 over them. */
export default async function UpdatesPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const plans = one(searchParams?.tab) === "plans";
  const q = (one(searchParams?.q) ?? "").trim();
  const drafting = one(searchParams?.new) === "1";
  const editing = one(searchParams?.edit) ?? "";
  const recording = one(searchParams?.plan) === "1";
  const error = one(searchParams?.error);
  const published = one(searchParams?.published);
  const saved = one(searchParams?.saved);
  const inReview = one(searchParams?.review);
  const recorded = one(searchParams?.recorded) === "1";
  /*
   * Whose work this screen is showing is not this screen's question any more.
   * It is chosen once on Workspace Overview and answered the same way
   * everywhere — see `lib/open-client.ts`.
   */
  const client = (await getOpenClientId()) ?? "";
  const showClients = await usesClientWorkspaces();

  const [result, requests, clients] = await Promise.all([
    listUpdates(plans ? "plans_update" : "progress_update"),
    drafting || editing ? listRequestOptions() : Promise.resolve([]),
    // The filter draws this list on every visit, not only while the Plans
    // dialog is open, so it is no longer fetched conditionally.
    listClientOptions(),
  ]);

  const workspaceName = clients.find((row) => row.id === client)?.name;

  const inClient = result.ok
    ? result.rows.filter((row) => !client || row.clientId === client)
    : [];
  const rows = inClient.filter((row) =>
    matchesSearch(q, [
      row.headline,
      row.body,
      row.category,
      row.requestTitle,
      row.clientName,
      row.authorName,
      statusLabel(row.status),
    ]),
  );

  // Which tab and which workspace are both where you are, so every link out of
  // this screen and back has to carry them.
  const state = new URLSearchParams();
  if (plans) state.set("tab", "plans");
  if (client) state.set("client", client);
  if (q) state.set("q", q);
  const here = state.toString() ? `${LIST}?${state}` : LIST;
  const alsoHere = (key: string, value: string) => {
    const next = new URLSearchParams(state);
    next.set(key, value);
    return `${LIST}?${next}`;
  };

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <PageHeader
        title="Updates"
        size={22}
        gap={20}
        action={
          plans ? (
            <Button unsized href={alsoHere("plan", "1")} variant="primary" className="px-4 py-[9px] text-[13.5px]">
              + Record a Plans update
            </Button>
          ) : (
            <Button unsized href={alsoHere("new", "1")} variant="primary" className="px-4 py-[9px] text-[13.5px]">
              + New Progress Update
            </Button>
          )
        }
      />

      <div className="mb-5 flex gap-6 border-b border-line">
        {[
          { slug: "", label: "Progress Updates" },
          { slug: "plans", label: "Plans & Updates" },
        ].map((tab) => {
          const on = tab.slug === (plans ? "plans" : "");
          return (
            <Link
              key={tab.label}
              href={
                tab.slug
                  ? `${LIST}?tab=${tab.slug}${client ? `&client=${encodeURIComponent(client)}` : ""}`
                  : client
                    ? `${LIST}?client=${encodeURIComponent(client)}`
                    : LIST
              }
              className="pb-2.5 text-[13.5px] no-underline"
              style={{
                color: on ? "var(--ink)" : "var(--text-tertiary)",
                fontWeight: on ? 600 : 400,
                borderBottom: on ? "2px solid var(--ink)" : "2px solid transparent",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {inClient.length > 0 ? (
        <FilterBar
          action={LIST}
          searchPlaceholder="Search updates…"
          searchValue={q}
          hidden={{
            tab: plans ? "plans" : undefined,
            client: client || undefined,
          }}
        />
      ) : null}

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Updates. Check your connection and try again. If this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Updates%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px]">
                Try again
              </Button>
            </>
          }
        />
      ) : inClient.length === 0 ? (
        <StateMessage
          glyph="◒"
          // A workspace filter that matches nothing was telling people to
          // write their first update while several sat behind the client they
          // had just chosen.
          title={
            workspaceName
              ? `Nothing in ${workspaceName}`
              : plans
                ? "Nothing recorded yet"
                : "No updates yet"
          }
          description={
            workspaceName
              ? "No update belongs to this workspace. Choose All clients on Workspace Overview to see the rest."
              : plans
                ? "When a client tells you something that changes how their work has to run, such as travel, a new assistant, or a move they are weighing, write it down here so it is not only in someone's head."
                : "A Progress Update is what the client reads: what has moved, what is next, and anything waiting on them. Draft one against a Request."
          }
          action={
            <Button unsized
              href={plans ? alsoHere("plan", "1") : alsoHere("new", "1")}
              variant="primary"
              className="px-5 py-2.5 text-[13.5px]"
            >
              {plans ? "+ Record a Plans update" : "+ New Progress Update"}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Nothing matches “{q}”.
        </p>
      ) : plans ? (
        <DataTable columns={showClients ? PLAN_COLUMNS : PLAN_COLUMNS.filter((column) => column.label !== "Client")} rowPadding={13}>
          {rows.map((row) => (
            <DataTableRow key={row.id}>
              <DataTableCell emphasis="ink">{row.headline}</DataTableCell>
              {showClients ? <DataTableCell>{row.clientName ?? "No client"}</DataTableCell> : null}
              <DataTableCell emphasis="muted">
                {shortDate(row.publishedAt ?? row.createdAt)}
              </DataTableCell>
              <DataTableCell>
                {row.linkedTaskId ? "Linked to Task" : "No action needed"}
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTable>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <UpdateCard key={row.id} update={row} href={alsoHere("edit", row.id)} />
          ))}
        </div>
      )}

      {drafting || editing ? (
        <DraftUpdateDialog
          requests={requests}
          update={
            editing
              ? (result.ok ? result.rows.find((row) => row.id === editing) : null) ?? null
              : null
          }
          closeHref={here}
          error={error}
        />
      ) : null}

      {recording ? (
        <PlansUpdateDialog
          clients={clients.map((client) => ({ id: client.id, title: client.name }))}
          closeHref={here}
          error={error}
        />
      ) : null}

      {published ? (
        <Toast
          title="Progress update published"
          detail={
            showClients
              ? `"${published}" is on the client's portal. Nothing was emailed, because no mailbox is connected.`
              : `"${published}" is now visible to your team.`
          }
          closeHref={here}
        />
      ) : null}

      {saved ? (
        <Toast
          title="Saved as a draft"
          detail={`"${saved}" is on this list and nowhere else. Nobody has seen it.`}
          closeHref={here}
        />
      ) : null}

      {inReview ? (
        <Toast
          title="Sent for review"
          detail={`"${inReview}" is waiting on a colleague before it reaches the client.`}
          closeHref={here}
        />
      ) : null}

      {recorded ? (
        <Toast
          title="Recorded"
          detail="It is on the client's account for whoever picks up the work next."
          closeHref={here}
        />
      ) : null}
    </div>
  );
}

/**
 * One update, as screen 10 draws it.
 *
 * Three grounds, not one: a published update on white, a draft on #fafafa so
 * an unfinished one is visibly quieter than a sent one, and an urgent update
 * on #fff8f7 inside a red border. The export's urgent ground is pink and not
 * the amber this used, which is the colour of a warning rather than of
 * something wrong.
 *
 * The card opens the update. Publishing used to be a link in the corner of it,
 * which meant a draft could be sent to a client from a list, without its text
 * being read, by a button sitting an inch from Publish on the next card down.
 * 10.1 is where that decision is made, next to the words it will send.
 */
function UpdateCard({ update, href }: { update: UpdateRow; href: string }) {
  const when = update.publishedAt
    ? `Published ${shortDate(update.publishedAt)}`
    : update.status === "review"
      ? `Drafted ${shortDate(update.createdAt)}`
      : `Last edited ${shortDate(update.createdAt)}`;

  const ground = update.urgent
    ? { border: "1px solid var(--urgent-border)", background: "var(--urgent-bg)" }
    : update.status === "draft"
      ? { border: "1px solid var(--border)", background: "var(--surface-dim)" }
      : { border: "1px solid var(--border)" };

  return (
    <Link
      href={href}
      scroll={false}
      className="block rounded-[8px] px-[18px] py-4 no-underline transition-colors"
      style={{ ...ground, color: "var(--ink)" }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {update.urgent ? <Pill tone="danger">Urgent</Pill> : null}
          <span className="min-w-0 truncate text-[14.5px] font-semibold">
            {update.headline}
          </span>
        </div>

        <Pill tone={statusTone(update.status)}>{statusLabel(update.status)}</Pill>
      </div>

      {update.body ? (
        <p className="mb-2 text-[12.5px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
          {update.body}
        </p>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2.5 text-[11.5px]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {update.requestTitle ? <Tag>{update.requestTitle}</Tag> : null}
        {update.category ? <Tag>{update.category}</Tag> : null}
        <span>
          {when}
          {update.authorName ? ` by ${update.authorName}` : ""}
          {/* The export reads "flagged urgent by Whitby". Nothing here read the
              text and decided that; somebody ticked a box. */}
          {update.urgent ? " · flagged urgent" : ""}
        </span>
      </div>
    </Link>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-line px-[7px] py-px">{children}</span>
  );
}
