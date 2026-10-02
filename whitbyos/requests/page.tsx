import Link from "next/link";
import { Button } from "@/base/components/Button";
import { SessionExpired } from "@/base/components/SessionExpired";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { NavIcon } from "@/base/components/NavIcons";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import { NewRequestDialog } from "@/whitbyos/requests/components/NewRequestDialog";
import { listClientOptions, listRequests } from "@/whitbyos/lib/requests";
import { relativeTime, shortDate } from "@/whitbyos/lib/format";
import { param, type SearchParams } from "@/whitbyos/lib/params";
import { getOpenClient } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { REQUEST_STATUSES, requestStatusLabel, requestStatusTone } from "@/whitbyos/lib/request-status";
import { Pill } from "@/base/components/Pill";

const LIST = "/whitbyos/requests";

const COLUMNS: Column[] = [
  { label: "Request", width: "2.2fr" },
  { label: "Client", width: "1.4fr" },
  { label: "Status", width: "1fr" },
  { label: "Due", width: "0.9fr" },
  { label: "Updated", width: "0.9fr" },
  { label: "", width: "88px" },
];

const NO_CLIENT_COLUMNS: Column[] = [
  { label: "Request", width: "2.6fr" },
  { label: "Status", width: "1fr" },
  { label: "Due", width: "1fr" },
  { label: "Updated", width: "1fr" },
  { label: "", width: "88px" },
];

function softBorder() {
  return "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)";
}

function listHref(parts: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parts)) {
    if (value) query.set(key, value);
  }
  const search = query.toString();
  return search ? `${LIST}?${search}` : LIST;
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const search = param(searchParams, "q") ?? "";
  const status = param(searchParams, "status") ?? "";
  const urgency = param(searchParams, "urgency") ?? "";
  const sort = param(searchParams, "sort") ?? "";
  const link = param(searchParams, "link") ?? "";
  const showingAll = param(searchParams, "all") === "1";

  const openClient = await getOpenClient();
  const showClients = await usesClientWorkspaces();
  /*
   * Scoped to the open client unless `?all=1`.
   * Same rule as Clients / Contacts — Workspace Overview chooses who is open;
   * this screen does not switch them.
   */
  const scopedTo = showClients && !showingAll ? openClient?.id ?? null : null;

  const [result, clients] = await Promise.all([
    listRequests({
      q: search,
      status,
      client: scopedTo ?? undefined,
      link: link || undefined,
      urgency,
      sort,
    }),
    showClients ? listClientOptions() : Promise.resolve([]),
  ]);

  const dialogOpen = param(searchParams, "new") === "1";
  const filtered = Boolean(search || status || urgency || link);
  const rows = result.ok ? result.rows : [];

  const byStatus = new Map<string, number>();
  for (const row of rows) {
    const label = requestStatusLabel(row.status);
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
  }

  const filters = {
    q: search || undefined,
    status: status || undefined,
    urgency: urgency || undefined,
    sort: sort || undefined,
    link: link || undefined,
    all: showingAll ? "1" : undefined,
  };

  const subtitle = showClients
    ? "Client-linked and unlinked requests. Other clients stay out while one is open."
    : "Work from ask to completion. Whitby can draft a plan from what you describe.";

  const linkOptions = scopedTo && openClient
    ? [
        { value: "client", label: `This client (${openClient.name})` },
        { value: "none", label: "No client link" },
      ]
    : showClients
      ? [{ value: "none", label: "No client link" }]
      : [];

  return (
    <div className="min-h-full px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <div className="mb-6 flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          <NavIcon href="/whitbyos/requests" label="Requests" />
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Requests"
            subtitle={subtitle}
            size={22}
            gap={20}
            action={
              <Button
                href={listHref({
                  ...filters,
                  new: "1",
                  ...(scopedTo ? { client: scopedTo } : {}),
                })}
                variant="primary"
                unsized
                className="px-[18px] py-[9px] text-[14px]"
              >
                + New Request
              </Button>
            }
          />
        </div>
      </div>

      <FilterBar
        action={LIST}
        searchPlaceholder="Search requests…"
        searchValue={search}
        selects={[
          ...(linkOptions.length > 0
            ? [
                {
                  name: "link",
                  anyLabel: scopedTo
                    ? "This client & unlinked"
                    : "All links",
                  value: link,
                  options: linkOptions,
                },
              ]
            : []),
          {
            name: "status",
            anyLabel: "All statuses",
            value: status,
            options: REQUEST_STATUSES.map((row) => ({
              value: row.value,
              label: row.label,
            })),
          },
          {
            name: "urgency",
            anyLabel: "All urgency",
            value: urgency,
            options: [
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ],
          },
        ]}
        sort={{
          name: "sort",
          anyLabel: "Sort: Most recently updated",
          value: sort,
          options: [
            { value: "title", label: "Sort: Request name (A–Z)" },
            { value: "due", label: "Sort: Due date" },
          ],
        }}
        hidden={{ all: showingAll ? "1" : undefined }}
      />

      {rows.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {[...byStatus.entries()].map(([label, count]) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]"
              style={{
                borderColor: softBorder(),
                background: "var(--surface)",
                color: "var(--text-muted)",
              }}
            >
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {count}
              </span>
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <h2 className="mb-3 text-[15px] font-semibold tracking-[-0.15px]">
        {search
          ? `Requests matching “${search}”`
          : link === "client" && openClient
            ? "Linked to this client"
            : link === "none"
              ? "No client link"
              : "Requests"}
      </h2>

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your requests. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button
                href="mailto:support@privateattache.com?subject=Requests%20failed%20to%20load"
                variant="secondary"
              >
                Contact support
              </Button>
              <Button href={LIST} variant="primary">
                Try again
              </Button>
            </>
          }
        />
      ) : rows.length === 0 ? (
        <div
          className="rounded-[12px] border px-8 py-10"
          style={{ borderColor: softBorder(), background: "var(--surface)" }}
        >
          <StateMessage
            glyph="☰"
            title={filtered ? "No requests match those filters" : "No requests yet"}
            description={
              filtered
                ? "Try a different search, or clear the filters."
                : showClients
                  ? "Requests track a piece of work from ask to completion. Link one to a client, or leave it unlinked."
                  : "Requests track a piece of work from ask to completion. Describe what you need in plain language and Whitby will draft a plan to review."
            }
            action={
              filtered ? (
                <Button href={LIST} variant="secondary">
                  Clear filters
                </Button>
              ) : (
                <Button href={`${LIST}?new=1`} variant="primary">
                  + New Request
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[12px] border"
          style={{
            borderColor: softBorder(),
            background: "var(--surface)",
            boxShadow: "0 1px 2px rgba(31,72,125,.04)",
          }}
        >
          <DataTable
            columns={showClients ? COLUMNS : NO_CLIENT_COLUMNS}
            rowPadding={12}
          >
            <ShowMore step={10}>
              {rows.map((request) => (
                <DataTableRow
                  key={request.id}
                  href={`/whitbyos/requests/${request.id}`}
                  trailing={
                    <Link
                      href={`/whitbyos/requests/${request.id}`}
                      className="rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
                      style={{
                        borderColor: "var(--border-strong)",
                        background: "var(--surface)",
                        color: "var(--ink)",
                      }}
                    >
                      View
                    </Link>
                  }
                >
                  <DataTableCell emphasis="strong">{request.title}</DataTableCell>
                  {showClients ? (
                    <DataTableCell>
                      {request.client_id ? (
                        request.client_name
                      ) : (
                        <span style={{ color: "var(--text-tertiary)" }}>None</span>
                      )}
                    </DataTableCell>
                  ) : null}
                  <span>
                    <Pill tone={requestStatusTone(request.status)}>
                      {requestStatusLabel(request.status)}
                    </Pill>
                  </span>
                  <DataTableCell>{shortDate(request.target_date)}</DataTableCell>
                  <DataTableCell emphasis="muted">
                    {relativeTime(request.updated_at)}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </ShowMore>
          </DataTable>
        </div>
      )}

      {dialogOpen ? (
        <NewRequestDialog
          clients={clients}
          closeHref={listHref(filters)}
          error={param(searchParams, "error")}
          defaultClientId={
            param(searchParams, "client") || scopedTo || undefined
          }
          usesClientWorkspaces={showClients}
        />
      ) : null}

      {param(searchParams, "expired") === "1" ? (
        <SessionExpired next="/whitbyos/requests" />
      ) : null}
    </div>
  );
}
