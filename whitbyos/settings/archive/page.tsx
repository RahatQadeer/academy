import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { restoreArchived } from "@/whitbyos/settings/archive/actions";
import { DeleteArchivedButton } from "@/whitbyos/settings/archive/DeleteArchivedButton";
import { graceLeft, needsApproval, withinGrace } from "@/whitbyos/lib/deletion";
import {
  ARCHIVE_NOT_YET,
  ARCHIVE_TYPES,
  listArchived,
  type ArchiveType,
} from "@/whitbyos/lib/archive";
import { shortDate } from "@/whitbyos/lib/format";
import { FilterSelect } from "@/whitbyos/components/FilterSelect";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { SearchField } from "@/whitbyos/components/SearchField";
import { LiveSearch } from "@/whitbyos/components/LiveSearch";

const ARCHIVE = "/whitbyos/settings/archive";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screen 17.7 — Archive. */
export default async function ArchiveSettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const asked = one(searchParams?.type);
  const showClients = await usesClientWorkspaces();
  const types = showClients
    ? ARCHIVE_TYPES
    : ARCHIVE_TYPES.filter((row) => row.value !== "client");
  const type = types.some((row) => row.value === asked)
    ? (asked as ArchiveType)
    : undefined;

  const query = (one(searchParams?.q) ?? "").trim();
  const found = await listArchived(type);
  const reachable = showClients ? found : found.filter((item) => item.type !== "client");

  // 17.7 searches what is on the screen, which is one list of several kinds —
  // so it matches the name and the place it was in, the two columns somebody
  // reading this list would recognise something by.
  const items = query
    ? reachable.filter((item) =>
        [item.name, item.wasIn]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query.toLowerCase())),
      )
    : reachable;

  const restored = one(searchParams?.restored) === "1";
  const deleted = one(searchParams?.deleted);
  const askedFor = one(searchParams?.asked);
  const error = one(searchParams?.error);

  return (
    <SettingsShell active="archive" title="Archive" width={860}>
      {/* 17.7 draws a type select and a search box, not a row of pills. */}
      <form action={ARCHIVE} method="get" className="mb-3.5 flex flex-wrap gap-2.5">
        <FilterSelect
          name="type"
          value={type ?? ""}
          all="All types"
          options={types.map((row) => ({ value: row.value, label: row.label }))}
        />
        <SearchField
          defaultValue={query}
          placeholder="Search archived items…"
          label="Search archived items"
          className="w-[260px]"
        />
        {/* Narrows as you type — see `LiveSearch`. */}
        <LiveSearch />
      </form>

      {items.length === 0 ? (
        <div
          className="rounded-[10px] border border-line px-4 py-10 text-center text-[13px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {query
            ? `Nothing archived matches “${query}”.`
            : `Nothing archived${type ? " of this kind" : ""} yet.`}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-line">
          <div
            className="grid items-center gap-2.5 px-4 py-[9px] text-[10.5px] font-semibold uppercase tracking-[0.04em]"
            style={{
              /*
               * 190px at the end, not 84.
               *
               * Restore and Ask to delete had to share 84 pixels, so the
               * second one came out as three stacked words — "Ask / to /
               * delete" — and pushed its own row taller than every other.
               */
              gridTemplateColumns: "2.2fr 0.9fr 1.1fr 0.8fr 190px",
              background: "var(--surface-soft)",
              color: "var(--text-tertiary)",
            }}
          >
            <span>Name</span>
            <span>Type</span>
            <span>Was in</span>
            <span>Archived</span>
            <span />
          </div>

          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="grid items-center gap-2.5 border-t border-line px-4 py-3 text-[13.5px] transition-colors hover:bg-[var(--surface-soft)]"
              style={{ gridTemplateColumns: "2.2fr 0.9fr 1.1fr 0.8fr 190px" }}
            >
              <span className="min-w-0 truncate">
                {item.href ? (
                  <Link href={item.href} className="no-underline" style={{ color: "var(--ink)" }}>
                    {item.name}
                  </Link>
                ) : (
                  item.name
                )}
              </span>
              <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                {item.typeLabel}
              </span>
              <span className="min-w-0 truncate text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                {item.wasIn}
              </span>
              <span className="text-[12.5px]" style={{ color: "rgba(55,53,47,.55)" }}>
                {item.archivedAt ? shortDate(item.archivedAt) : "Not recorded"}
              </span>

              <span className="flex items-center justify-end gap-2 whitespace-nowrap">
                <form action={restoreArchived}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="type" value={item.type} />
                  <SubmitPlain
                   
                    className="rounded-control border px-2.5 py-[5px] text-[12px] font-medium transition-colors hover:bg-[var(--surface-soft)]"
                    style={{
                      borderColor: "var(--border-strong)",
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                  >
                    Restore
                  </SubmitPlain>
                </form>

                {/* The only Delete in Whitby. What it does depends on the
                    record's age and whose it is, and the button says which
                    before it is pressed rather than after. */}
                {item.pendingDeletion ? (
                  <span
                    className="rounded-control px-2.5 py-[5px] text-[12px] font-medium"
                    style={{ background: "var(--warning-bg)", color: "var(--warning-fg)" }}
                    title="The client has been asked and has not answered yet"
                  >
                    Waiting on the client
                  </span>
                ) : (
                  <DeleteArchivedButton
                    id={item.id}
                    type={item.type}
                    asks={!withinGrace(item.createdAt) && needsApproval(item.type)}
                    minutesLeft={graceLeft(item.createdAt)}
                  />
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* This note named the kinds nothing could archive yet — six of them, then
          one. There are none left, so it draws nothing rather than an empty
          sentence about an empty list. */}
      {ARCHIVE_NOT_YET.length > 0 ? (
        <p className="mt-4 text-[11.5px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
          {ARCHIVE_NOT_YET.join(", ")} cannot be archived yet, nothing records it
          against them. They will appear here once they can.
        </p>
      ) : null}

      {restored ? (
        <Toast title="Restored" detail="It is back where it was." closeHref={ARCHIVE} />
      ) : null}

      {deleted ? (
        <Toast
          title="Deleted"
          detail={`"${deleted}" is gone, along with everything filed under it.`}
          closeHref={ARCHIVE}
        />
      ) : null}

      {askedFor ? (
        <Toast
          tone="warning"
          title="The client has been asked"
          detail={`"${askedFor}" stays until they accept. Nothing has been deleted.`}
          closeHref={ARCHIVE}
        />
      ) : null}

      {error ? (
        <Toast tone="warning" title="Not deleted" detail={error} closeHref={ARCHIVE} />
      ) : null}
    </SettingsShell>
  );
}

