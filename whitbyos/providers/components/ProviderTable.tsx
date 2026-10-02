"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { ArchiveOrDeleteLink } from "@/whitbyos/components/ArchiveOrDelete";
import { DataTable, DataTableCell, DataTableRow, type Column } from "@/whitbyos/components/DataTable";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { initialsOf } from "@/whitbyos/lib/contact-vocab";
import { relativeTime } from "@/whitbyos/lib/format";
import { outreachLabel, readinessLabel, readinessTone } from "@/whitbyos/lib/provider-vocab";
import type { ProviderChild, ProviderRow } from "@/whitbyos/lib/providers";

/**
 * The directory as it is actually shaped: firms, and the people at them.
 *
 * A flat list puts a partner and the firm they work at side by side as though
 * they were unrelated entries, and the same firm's five people scattered
 * wherever their names happen to sort. Under the firm, indented, is where they
 * are — and collapsed, because the firm is usually the answer and its people
 * are the detail behind it.
 *
 * Somebody independent stays at the left margin. They are not under anybody,
 * and indenting them to line up with the nested rows would say they were.
 */
export function ProviderTable({
  rows,
  people,
  columns,
  listHref,
}: {
  rows: ProviderRow[];
  /** Everybody at those firms who is not a provider in their own right. */
  people: ProviderChild[];
  columns: Column[];
  listHref: string;
}) {
  const children = new Map<string, ProviderRow[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const held = children.get(row.parentId);
    if (held) held.push(row);
    else children.set(row.parentId, [row]);
  }

  const staff = new Map<string, ProviderChild[]>();
  for (const person of people) {
    const held = staff.get(person.parentId);
    if (held) held.push(person);
    else staff.set(person.parentId, [person]);
  }

  const top = rows.filter((row) => !row.parentId);

  /*
   * Open by default when a search or filter is on.
   *
   * Otherwise a search that matched somebody inside a firm appears to have
   * matched nothing: the row is there, folded away behind a triangle.
   */
  const [opened, setOpened] = useState<string[]>([]);

  function toggle(id: string) {
    setOpened((was) => (was.includes(id) ? was.filter((at) => at !== id) : [...was, id]));
  }

  const showClient = columns.some((column) => column.label === "Available to");

  return (
    <DataTable columns={columns} rowPadding={11}>
      <ShowMore>
        {top.map((provider) => {
          const asProviders = children.get(provider.id) ?? [];
          const asPeople = staff.get(provider.id) ?? [];
          const inside = asProviders.length + asPeople.length;
          const open = opened.includes(provider.id);

          return (
            <Rows key={provider.id}>
              <Row
                provider={provider}
                listHref={listHref}
                peopleCount={inside}
                showClient={showClient}
                folder={
                  inside > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggle(provider.id)}
                      aria-expanded={open}
                      aria-label={
                        open
                          ? `Hide the people at ${provider.name}`
                          : `Show the ${inside} people at ${provider.name}`
                      }
                      className="pa-fold relative z-20 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border"
                      style={{
                        /* Parent firm control — tan, not accent blue. People
                           under it keep the blue face. */
                        borderColor: open
                          ? "color-mix(in srgb, var(--avatar-tan-fg) 28%, var(--border-strong))"
                          : "var(--border-strong)",
                        background: open ? "var(--avatar-tan-bg)" : "var(--surface-soft)",
                        color: open ? "var(--avatar-tan-fg)" : "var(--text-secondary)",
                      }}
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                        style={{
                          transform: open ? "rotate(90deg)" : "none",
                          transition: "transform 140ms ease",
                        }}
                      >
                        <path
                          d="m9 5 7 7-7 7"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : (
                    <span className="w-[22px] shrink-0" />
                  )
                }
              />

              {open ? (
                <>
                  {asProviders.map((person) => (
                    <Row key={person.id} provider={person} listHref={listHref} indented showClient={showClient} />
                  ))}
                  {asPeople.map((person) => (
                    <PersonRow key={person.id} person={person} showClient={showClient} />
                  ))}
                </>
              ) : null}
            </Rows>
          );
        })}
      </ShowMore>
    </DataTable>
  );
}

/** A fragment with a key, so a firm and its people stay one item to `ShowMore`. */
function Rows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Face({
  name,
  kind,
  small,
}: {
  name: string;
  kind: "company" | "person";
  small?: boolean;
}) {
  const company = kind === "company";
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-bold ${
        small ? "h-7 w-7 text-[10.5px]" : "h-8 w-8 text-[11px]"
      } ${company ? "rounded-[8px]" : "rounded-full"}`}
      style={
        company
          ? { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }
          : { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }
      }
    >
      {initialsOf(name)}
    </span>
  );
}

function Row({
  provider,
  listHref,
  folder,
  indented,
  peopleCount = 0,
  showClient = true,
}: {
  provider: ProviderRow;
  listHref: string;
  folder?: React.ReactNode;
  indented?: boolean;
  peopleCount?: number;
  showClient?: boolean;
}) {
  const person = provider.type === "Individual";

  return (
    <DataTableRow
      href={`${listHref}/${provider.id}`}
      nested={indented}
      trailing={
        <span className="flex items-center gap-1.5">
          <Link
            href={`${listHref}/${provider.id}`}
            className="rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          >
            View
          </Link>
          <ArchiveOrDeleteLink
            href={`${listHref}?remove=${provider.id}`}
            label="Archive provider"
          />
        </span>
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        {indented ? (
          <span
            className="ml-[11px] flex min-w-0 items-center gap-2.5 border-l pl-3"
            style={{ borderColor: "var(--border)" }}
          >
            <Face name={provider.name} kind="person" small />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium">{provider.name}</span>
            </span>
          </span>
        ) : (
          <>
            {folder}
            <Face name={provider.name} kind={person ? "person" : "company"} />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium">{provider.name}</span>
              {peopleCount > 0 ? (
                <span className="block truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {peopleCount === 1 ? "1 person" : `${peopleCount} people`}
                </span>
              ) : null}
            </span>
          </>
        )}
      </span>
      <span>
        <Pill tone={person ? "info" : "neutral"}>{provider.type}</Pill>
      </span>
      <DataTableCell>{provider.category ?? "No category"}</DataTableCell>
      {showClient ? (
        <DataTableCell>{provider.clientName ?? "Any client"}</DataTableCell>
      ) : null}
      <span>
        <Pill tone={readinessTone(provider.readiness)}>
          {readinessLabel(provider.readiness)}
        </Pill>
      </span>
      <DataTableCell>{outreachLabel(provider.outreach)}</DataTableCell>
      <DataTableCell>{provider.ownerName ?? "Unassigned"}</DataTableCell>
      <DataTableCell emphasis="muted">{relativeTime(provider.updated_at)}</DataTableCell>
    </DataTableRow>
  );
}

/**
 * Somebody at the firm who is not a provider themselves.
 *
 * The provider columns are left empty rather than filled with something that
 * looks like an answer: a person has no readiness, no outreach state and no
 * category of their own. What they have is a role at this firm, which is the
 * thing worth knowing about them here.
 */
function PersonRow({ person, showClient = true }: { person: ProviderChild; showClient?: boolean }) {
  return (
    <DataTableRow
      href={person.href}
      nested
      trailing={
        <Link
          href={person.href}
          className="rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
          style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
        >
          View
        </Link>
      }
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="ml-[11px] flex min-w-0 items-center gap-2.5 border-l pl-3"
          style={{ borderColor: "var(--border)" }}
        >
          <Face name={person.name} kind="person" small />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                {person.name}
              </span>
              {person.isPrimary ? (
                <span
                  className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.03em]"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  Contact
                </span>
              ) : null}
            </span>
            <span
              className="block truncate text-[12px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {[person.role, person.email].filter(Boolean).join(" · ") || "At this firm"}
            </span>
          </span>
        </span>
      </span>
      <span>
        <Pill>Person</Pill>
      </span>
      <DataTableCell emphasis="muted">{person.role ?? ""}</DataTableCell>
      {showClient ? <span /> : null}
      <span />
      <span />
      <span />
      <span />
    </DataTableRow>
  );
}
