import { getOpenClient } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import { NewFileDialog } from "@/whitbyos/knowledge/components/NewFileDialog";
import { FilterSelect } from "@/whitbyos/components/FilterSelect";
import {
  ArchiveOrDeleteDialog,
  ArchiveOrDeleteLink,
} from "@/whitbyos/components/ArchiveOrDelete";
import { archiveArticle } from "@/whitbyos/knowledge/actions";
import {
  KNOWLEDGE_CATEGORIES,
  listKnowledge,
  scopeLabel,
} from "@/whitbyos/lib/knowledge";
import { shortDate } from "@/whitbyos/lib/format";
import { SearchField } from "@/whitbyos/components/SearchField";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { NavIcon } from "@/base/components/NavIcons";
import { LiveSearch } from "@/whitbyos/components/LiveSearch";

const LIST = "/whitbyos/knowledge";

const SCOPES = [
  { slug: "", label: "Everything" },
  { slug: "organization", label: "Organization" },
  /* "This workspace" rather than "Workspace": the filter narrows the
     list to the workspace already open, so it names where you are. */
  { slug: "client", label: "This workspace" },
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screen 13 — the Knowledge Library, with 13.2 over it. */
export default async function KnowledgePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const scope = one(searchParams?.scope) ?? "";
  const category = one(searchParams?.category) ?? "";
  const adding = one(searchParams?.new) === "1";
  const error = one(searchParams?.error);
  const removing = one(searchParams?.remove) ?? "";
  const query = (one(searchParams?.q) ?? "").trim();
  const showClients = await usesClientWorkspaces();

  const result = await listKnowledge();
  const state = new URLSearchParams();
  if (scope) state.set("scope", scope);
  // Kept in the URL with the rest, so a dialog opened from a filtered library
  // comes back to the same filtered library.
  if (category) state.set("category", category);
  if (query) state.set("q", query);
  const here = state.toString() ? `${LIST}?${state}` : LIST;

  const rows = (result.ok ? result.rows : [])
    .filter((row) => !scope || row.scope === scope)
    .filter((row) => !category || row.category === category)
    // 13 searches the titles and the categories — what a row shows.
    .filter(
      (row) =>
        !query ||
        [row.title, row.category]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(query.toLowerCase())),
    );

  const target = removing ? rows.find((row) => row.id === removing) : undefined;

  return (
    <div className="min-h-full px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <div className="mb-6 flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          <NavIcon href="/whitbyos/knowledge" label="Knowledge Base" />
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Knowledge Base"
            subtitle="Store useful organization knowledge here so Whitby can use it when creating plans, tasks and recommendations."
            help="Articles here are what Whitby reads when it drafts a Work Plan, fills in a task, or answers Ask Whitby. Prefer firm SOPs, checklists and standards over one-off notes. Organization articles apply across clients; a client's own only while that client is open. Whitby will use what is already here instead of asking for it again."
            size={22}
            gap={20}
            action={
              <Button unsized href={`${LIST}?new=1`} variant="primary" className="px-4 py-[9px] text-[13.5px]">
                + New File
              </Button>
            }
          />
        </div>
      </div>

      {!result.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Knowledge library. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Knowledge%20failed%20to%20load"
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
        <div
          className="rounded-[12px] border px-8 py-10"
          style={{
            borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
            background: "var(--surface)",
          }}
        >
          <StateMessage
            glyph="▣"
            title="Nothing in the library yet"
            description="Store checklists, SOPs and standards here once. Whitby will use them when it drafts plans, tasks and recommendations, so the same facts are not asked for again."
            action={
              <Button unsized href={`${LIST}?new=1`} variant="primary" className="px-5 py-2.5 text-[13.5px]">
                + New File
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* 13 draws a search box and a scope select, in that order. */}
          <form
            action={LIST}
            method="get"
            className="mb-4 flex flex-wrap items-center gap-2.5 rounded-[10px] border px-3.5 py-3"
            style={{
              borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
              background: "rgba(255,255,255,.88)",
            }}
          >
            <SearchField
              defaultValue={query}
              placeholder="Search articles"
              label="Search articles"
              className="w-[260px]"
            />
            {/* Narrows as you type — see `LiveSearch`. */}
            <LiveSearch />
            {/* The category was written on every row and searched, and there
                was no way to ask for one — so a library of forty files could
                be read by shelf only by typing the shelf's name. */}
            <FilterSelect
              name="category"
              value={category}
              all="All categories"
              options={KNOWLEDGE_CATEGORIES.map((name) => ({ value: name, label: name }))}
            />
            <FilterSelect
              name="scope"
              value={scope}
              all="All scopes"
              options={(showClients ? SCOPES : SCOPES.filter((item) => item.slug !== "client"))
                .filter((item) => item.slug)
                .map((item) => ({
                  value: item.slug,
                  label: item.label,
                }))}
            />
            <span
              className="ml-auto text-[12px] font-medium tabular-nums"
              style={{ color: "var(--text-tertiary)" }}
            >
              {rows.length} {rows.length === 1 ? "article" : "articles"}
            </span>
          </form>

          {rows.length === 0 ? (
            <p
              className="rounded-[10px] border py-12 text-center text-[13px]"
              style={{
                borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                background: "var(--surface)",
                color: "var(--text-tertiary)",
              }}
            >
              {query
                ? `Nothing matches “${query}”.`
                : "Nothing at this scope yet."}
            </p>
          ) : (
            <div
              className="overflow-hidden rounded-[12px] border"
              style={{
                borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                background: "var(--surface)",
                boxShadow: "0 1px 2px rgba(31,72,125,.04)",
              }}
            >
              <ShowMore step={7}>
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="group flex items-center gap-3 border-b px-4 py-3.5 last:border-b-0"
                    style={{ borderColor: "var(--chrome-line)" }}
                  >
                    <Link
                      href={`${LIST}/${row.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                      style={{ color: "var(--ink)" }}
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-semibold"
                        style={{
                          background: "var(--accent-tint)",
                          color: "var(--accent)",
                        }}
                      >
                        {row.type === "upload" ? "▣" : "≡"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="min-w-0 truncate text-[14px] font-semibold">
                            {row.title}
                          </span>
                          {/* Whose file it is: the organization's own, or one
                              client's — and then it wears their name, because
                              "This workspace" on a list read with no client open
                              names nobody. */}
                          <Pill tone={row.scope === "organization" ? "neutral" : "info"}>
                            {row.scope === "organization"
                              ? "Organization"
                              : showClients
                                ? (row.clientName ?? "Workspace")
                                : "Workspace"}
                          </Pill>
                        </span>
                        <span
                          className="mt-0.5 block truncate text-[12.5px]"
                          style={{ color: "var(--text-tertiary)" }}
                        >
                          {[row.category, `Updated ${shortDate(row.updatedAt)}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {row.type === "upload" ? (
                        <span className="shrink-0 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          File
                        </span>
                      ) : null}
                    </Link>

                    {/* The row is a link, but a link with no edge to it is a
                        thing people hover over to find out. Open says so. */}
                    <Button
                      unsized
                      href={`${LIST}/${row.id}`}
                      variant="secondary"
                      className="shrink-0 px-3 py-[5px] text-[12.5px]"
                    >
                      Open
                    </Button>

                    {/* 13 draws this on every row, and 13.3 is what it opens. */}
                    <ArchiveOrDeleteLink
                      href={`${here}${here.includes("?") ? "&" : "?"}remove=${row.id}`}
                      label="Archive article"
                    />
                  </div>
                ))}
              </ShowMore>
            </div>
          )}
        </>
      )}

      {target ? (
        <ArchiveOrDeleteDialog
          title={`Archive "${target.title}"?`}
          lead="This article is scoped to a workspace and may be referenced elsewhere. Choose what to remove:"
          linked={
            <>
              Scope: <strong style={{ color: "var(--ink)" }}>{scopeLabel(target.scope)}</strong>
              {target.category ? (
                <>
                  {" "}· Category:{" "}
                  <strong style={{ color: "var(--ink)" }}>{target.category}</strong>
                </>
              ) : null}
            </>
          }
          archiveLabel="Archive this article"
          archiveDetail="Hidden from the Library but recoverable later"
          deleteDetail="Removes the article and its content for good"
          archiveAction={archiveArticle}
          hidden={{ article_id: target.id }}
          closeHref={here}
        />
      ) : null}

      {adding ? (
        <NewFileDialog
          categories={KNOWLEDGE_CATEGORIES}
          clientName={showClients ? (await getOpenClient())?.name ?? null : null}
          closeHref={here}
          error={error}
        />
      ) : null}

      {one(searchParams?.saved) ? (
        <Toast title="File saved" detail="It is in the library." closeHref={here} />
      ) : null}
    </div>
  );
}
