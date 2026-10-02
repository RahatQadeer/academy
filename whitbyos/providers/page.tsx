import { Button } from "@/base/components/Button";
import { FilterSelect } from "@/whitbyos/components/FilterSelect";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import { type Column } from "@/whitbyos/components/DataTable";
import { AddProviderDialog } from "@/whitbyos/providers/components/AddProviderDialog";
import { ProviderGroups } from "@/whitbyos/providers/components/ProviderGroups";
import { ProviderTable } from "@/whitbyos/providers/components/ProviderTable";
import {
  ArchiveOrDeleteDialog,
} from "@/whitbyos/components/ArchiveOrDelete";
import { archiveProvider } from "@/whitbyos/providers/actions";
import {
  listCompanyOptions,
  listProviders,
  listTeammates,
  listUsedSpecialties,
} from "@/whitbyos/lib/providers";
import { listCategories } from "@/whitbyos/lib/taxonomy";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { OUTREACH, READINESS } from "@/whitbyos/lib/provider-vocab";
import { SearchField } from "@/whitbyos/components/SearchField";
import { LiveSearch } from "@/whitbyos/components/LiveSearch";

const LIST = "/whitbyos/providers";

// 5 draws Type between Name and Category, on 1.7/0.9/1.4/1/1.3/1.3/1.
const COLUMNS: Column[] = [
  { label: "Name", width: "2.1fr" },
  { label: "Type", width: "0.9fr" },
  { label: "Category", width: "1.4fr" },
  { label: "Available to", width: "1.2fr" },
  { label: "Readiness", width: "1fr" },
  { label: "Outreach State", width: "1.3fr" },
  { label: "Relationship Owner", width: "1.3fr" },
  { label: "Last Activity", width: "1fr" },
  { label: "", width: "108px" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screens 14 and 14b — the provider directory, and what it says when it fails. */
export default async function ProvidersPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const q = one(searchParams?.q)?.trim() ?? "";
  const type = one(searchParams?.type) ?? "";
  const category = one(searchParams?.category) ?? "";
  const readiness = one(searchParams?.readiness) ?? "";
  const outreach = one(searchParams?.outreach) ?? "";
  const adding = one(searchParams?.new) === "1";
  const created = one(searchParams?.created);
  const removed = one(searchParams?.removed) === "1";
  const error = one(searchParams?.error);
  const removing = one(searchParams?.remove) ?? "";
  const grouped = one(searchParams?.view) === "category";

  /*
   * Whose workspace this is being added in.
   *
   * Every other list in Whitby reads this and Providers never did, so the Add
   * dialog offered to file a provider against any client in the firm while one
   * client's workspace was plainly open on the screen behind it — a list of
   * four names when only two answers make sense: this client, or nobody in
   * particular.
   */
  const openClientId = await getOpenClientId();
  const showClients = await usesClientWorkspaces();
  const columns = showClients
    ? COLUMNS
    : COLUMNS.filter((column) => column.label !== "Available to");

  const [result, companies, teammates, everyClient, categories, usedSpecialties] =
    await Promise.all([
      listProviders({ q, type, category, readiness, outreach }),
      adding ? listCompanyOptions() : Promise.resolve([]),
      adding ? listTeammates() : Promise.resolve([]),
      adding && showClients ? listClientOptions() : Promise.resolve([]),
      adding ? listCategories() : Promise.resolve([]),
      adding ? listUsedSpecialties() : Promise.resolve([]),
    ]);

  // With a client open, the only client to link to is that one. Shared, or
  // theirs; never somebody else's, from in here.
  const clients = openClientId
    ? everyClient.filter((client) => client.id === openClientId)
    : everyClient;

  const filtering = Boolean(q || type || category || readiness || outreach);
  const removingProvider =
    removing && result.ok ? result.rows.find((row) => row.id === removing) : undefined;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <PageHeader
        title="Providers"
        subtitle={
          showClients
            ? "The people and companies you place work with. Whitby draws on this directory when it proposes options to a client."
            : "The people and companies you place work with."
        }
        gap={20}
        action={
          <div className="flex items-center gap-2.5">
          <Button
            href={`${LIST}?new=1`}
            variant="primary"
            unsized
            className="px-4 py-[9px] text-[14px]"
          >
            + Add Provider
          </Button>
          </div>
        }
      />

      {result.ok ? (
        <form
          action={LIST}
          className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5"
          style={{ background: "var(--surface)" }}
        >
          <SearchField
            defaultValue={q}
            placeholder="Search providers…"
            label="Search providers"
            className="w-[260px]"
          />
          {/* Narrows as you type — see `LiveSearch`. */}
          <LiveSearch />
          <FilterSelect name="type" value={type} all="All types"
            options={[
              { value: "Company", label: "Company" },
              { value: "Individual", label: "Individual" },
            ]} />
          <FilterSelect name="category" value={category} all="All categories"
            options={result.categories.map((c) => ({ value: c, label: c }))} />
          <FilterSelect name="readiness" value={readiness} all="All readiness"
            options={READINESS.map((r) => ({ value: r.value, label: r.label }))} />
          <FilterSelect name="outreach" value={outreach} all="All outreach states"
            options={OUTREACH.map((o) => ({ value: o.value, label: o.label }))} />

          {/*
           * Two ways of asking about the same directory.
           *
           * The table answers "what did I touch recently"; grouped answers
           * "who do we have for this", which is the question a directory is
           * opened with and the reason twenty-five categories exist. The
           * filters carry across, so a view is a way of reading what is on
           * screen rather than a different screen.
           */}
          <input type="hidden" name="view" value={grouped ? "" : "category"} />
          <button
            type="submit"
            className="ml-auto flex items-center gap-1.5 rounded-control border px-3 py-2 text-[13px] font-medium"
            style={{
              borderColor: "var(--border-strong)",
              background: "var(--surface-soft)",
              color: "var(--ink)",
            }}
          >
            {grouped ? "Show as list" : "Group by category"}
          </button>
        </form>
      ) : null}

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We could not load your Providers. Check your connection and try again. If this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Providers%20failed%20to%20load"
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
      ) : result.rows.length === 0 ? (
        <StateMessage
          glyph="◫"
          title={filtering ? "No providers match those filters" : "No providers yet"}
          description={
            filtering
              ? "Try widening the search, or clear the filters to see everyone."
              : "Providers are the people and companies you place work with: advisors, agents, schools, movers. Adding them builds the directory Whitby draws on when it proposes options."
          }
          action={
            <Button unsized
              href={filtering ? LIST : `${LIST}?new=1`}
              variant="primary"
              className="px-5 py-2.5 text-[13.5px]"
            >
              {filtering ? "Clear filters" : "+ Add your first provider"}
            </Button>
          }
        />
      ) : grouped ? (
        <ProviderGroups rows={result.rows} />
      ) : (
        <ProviderTable
          rows={result.rows}
          people={result.people}
          columns={columns}
          listHref={LIST}
        />
      )}

      {removingProvider ? (
        <ArchiveOrDeleteDialog
          title={`Archive ${removingProvider.name}?`}
          lead="This provider has linked records."
          linked={
            <>
              Linked:{" "}
              <strong style={{ color: "var(--ink)" }}>
                {removingProvider.category ?? "No category"}
              </strong>
              , outreach history, and the Documents on file.
            </>
          }
          archiveLabel="Archive this provider"
          archiveDetail="Its Documents stay linked. Unarchive anytime from Settings → Archive"
          deleteDetail="Also removes its outreach history and linked Documents. This can't be undone."
          archiveAction={archiveProvider}
          hidden={{ provider_id: removingProvider.id }}
          closeHref={LIST}
        />
      ) : null}

      {adding ? (
        <AddProviderDialog
          companies={companies}
          teammates={teammates}
          clients={clients}
          defaultClientId={openClientId}
          categories={categories}
          usedSpecialties={usedSpecialties}
          closeHref={LIST}
          error={error}
        />
      ) : null}

      {removed ? (
        <Toast
          title="Provider removed"
          detail="They are out of your directory. The company and its people stay on file."
          closeHref={LIST}
        />
      ) : null}

      {created ? (
        <Toast
          title="Provider added"
          detail={`"${created}" is now in your directory.`}
          closeHref={LIST}
        />
      ) : null}
    </div>
  );
}

