import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { Callout } from "@/base/components/Callout";
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
import { ArchivePlaybookDialog } from "@/whitbyos/playbooks/components/ArchivePlaybookDialog";
import { getPlaybookLinks, listPlaybooks } from "@/whitbyos/lib/playbooks";
import { matchesSearch } from "@/whitbyos/lib/search";
import { sharedLabel, sharedTone } from "@/whitbyos/lib/playbook-vocab";
import { relativeTime } from "@/whitbyos/lib/format";
import { getOpenClientId } from "@/whitbyos/lib/open-client";

const LIST = "/whitbyos/playbooks";

const COLUMNS: Column[] = [
  { label: "Playbook", width: "2.4fr" },
  { label: "Category", width: "1.2fr" },
  { label: "Workstreams", width: "1fr" },
  { label: "Times Used", width: "1fr" },
  { label: "Last Updated", width: "1.2fr" },
  { label: "Shared As", width: "1.2fr" },
  // v2 keeps a fixed 32px lane on the end for the row's own Archive,
  // the same way WP.2 does. Without the lane the control has no track and
  // wraps onto a second line of the grid.
  { label: "", width: "32px" },
];

/** 6's three tabs, which are a filter on how far a Playbook reaches. */
const TABS = [
  { slug: "", label: "My Playbooks", level: "private" },
  { slug: "team", label: "Shared with Me", level: "team" },
  { slug: "organization", label: "Organization", level: "organization" },
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screens 6, 5.9 and 6.2 — the Playbooks list, empty, and failed. */
export default async function PlaybooksPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const tab = one(searchParams?.tab) ?? "";
  const q = (one(searchParams?.q) ?? "").trim();
  const error = one(searchParams?.error);
  /*
   * Whose work this screen is showing is not this screen's question any more.
   * It is chosen once on Workspace Overview and answered the same way
   * everywhere — see `lib/open-client.ts`.
   */
  const client = (await getOpenClientId()) ?? "";
  const removing = one(searchParams?.remove) ?? "";

  const result = await listPlaybooks();
  const empty = !result.ok || result.rows.length === 0;

  const href = (slug: string) => {
    const query = new URLSearchParams();
    if (slug) query.set("tab", slug);
    if (client) query.set("client", client);
    if (q) query.set("q", q);
    const search = query.toString();
    return search ? `${LIST}?${search}` : LIST;
  };
  const active = TABS.find((item) => item.slug === tab) ?? TABS[0]!;

  const rows = result.ok
    ? result.rows
        .filter((row) => (row.sharedLevel ?? "private") === active.level)
        // v2's filter reads "used in", so a Playbook qualifies by having been
        // used for that client at least once — not by belonging to them.
        .filter((row) => !client || row.clientIds.includes(client))
        .filter((row) =>
          matchesSearch(q, [row.name, row.category, sharedLabel(row.sharedLevel)]),
        )
    : [];

  const doomed = removing ? (result.ok ? result.rows.find((row) => row.id === removing) : null) : null;
  const links = doomed ? await getPlaybookLinks(doomed.id) : null;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      {/* 5.9 sets the title at 24px with 28px beneath and carries no controls
          at all, the one button lives inside the empty state. 6 sets it at
          26px with 20px, and puts Quick Add and New Playbook up here. */}
      <PageHeader
        title="Playbooks"
        size={empty ? 24 : 26}
        gap={empty ? 28 : 20}
        action={
          empty ? undefined : (
          <div className="flex items-center gap-2.5">
            {/* 15 draws Quick Add beside New Playbook, going to the same 1.1b
                menu the rail opens. It is the only screen in this reference
                that carries one. */}
            <Button unsized href={`${LIST}/new`} variant="primary" className="px-4 py-[9px] text-[13.5px]">
              + New Playbook
            </Button>
          </div>
          )
        }
      />

      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Playbooks. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Playbooks%20failed%20to%20load"
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
      ) : result.rows.length === 0 ? (
        <StateMessage
          glyph="▤"
          title="No Playbooks yet"
          description="Playbooks are reusable Work Stream templates, save one from a completed Work Plan, or build one from scratch to standardize how your team handles a type of engagement."
          action={
            <Button unsized href={`${LIST}/new`} variant="primary" className="px-5 py-2.5 text-[13.5px]">
              + New Playbook
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex gap-[22px] border-b border-line">
            {TABS.map((item) => {
              const on = item.slug === tab;
              return (
                <Link
                  key={item.label}
                  href={href(item.slug)}
                  className="pb-2.5 text-[13.5px] no-underline"
                  style={{
                    color: on ? "var(--ink)" : "var(--text-soft)",
                    fontWeight: on ? 600 : 400,
                    borderBottom: on ? "2px solid var(--ink)" : "2px solid transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <FilterBar
            action={LIST}
            searchPlaceholder="Search playbooks…"
            searchValue={q}
            hidden={{
              tab: tab || undefined,
              client: client || undefined,
            }}
          />

          {rows.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {q
                ? `Nothing matches “${q}”.`
                : client
                  ? "No Playbooks have been used for that client yet."
                  : "Nothing at this level yet."}
            </p>
          ) : (
            <DataTable columns={COLUMNS} rowPadding={14}>
              {rows.map((row) => (
                <DataTableRow
                  key={row.id}
                  href={`${LIST}/${row.id}`}
                  trailing={
                    // v2 writes the words rather than drawing a bin, and the
                    // outline is what keeps them from reading as switched off.
                    <Link
                      href={`${href(tab)}${href(tab).includes("?") ? "&" : "?"}remove=${row.id}`}
                      title="Archive playbook"
                      aria-label={`Archive ${row.name}`}
                      className="whitespace-nowrap rounded-[5px] border border-line px-2 py-[3px] text-[11.5px] no-underline transition-colors hover:border-[var(--danger-action-border)] hover:bg-[var(--danger-action-bg)] hover:text-[var(--danger-action-fg)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Archive
                    </Link>
                  }
                >
                  <DataTableCell emphasis="strong">{row.name}</DataTableCell>
                  <DataTableCell>{row.category ?? "No category"}</DataTableCell>
                  <DataTableCell>{row.streamCount}</DataTableCell>
                  <DataTableCell>{row.timesUsed}</DataTableCell>
                  <DataTableCell emphasis="muted">{relativeTime(row.updatedAt)}</DataTableCell>
                  <span>
                    <Pill tone={sharedTone(row.sharedLevel)}>{sharedLabel(row.sharedLevel)}</Pill>
                  </span>
                </DataTableRow>
              ))}
            </DataTable>
          )}
        </>
      )}

      {doomed && links ? (
        <ArchivePlaybookDialog
          playbookId={doomed.id}
          playbookName={doomed.name}
          links={links}
          closeHref={href(tab)}
        />
      ) : null}

      {one(searchParams?.archived) ? (
        <Toast
          title="Playbook archived"
          detail="Restore it anytime from Settings → Archive."
          closeHref={href(tab)}
        />
      ) : null}

      {one(searchParams?.deleted) ? (
        <Toast
          title="Playbook deleted"
          detail="Work Plans already built from it are unaffected."
          closeHref={href(tab)}
        />
      ) : null}
    </div>
  );
}
