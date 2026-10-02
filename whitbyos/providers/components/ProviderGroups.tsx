import Link from "next/link";
import { Pill } from "@/base/components/Pill";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import { initialsOf } from "@/whitbyos/lib/contact-vocab";
import { readinessLabel, readinessTone } from "@/whitbyos/lib/provider-vocab";
import type { ProviderRow } from "@/whitbyos/lib/providers";

/**
 * The directory by category, which is what the client asked the list to be.
 *
 * A table sorted by last activity answers "what did I touch recently". The
 * question a directory is opened with is the other one: who do we have for
 * this. Twenty-five categories exist to make that answerable, and a flat table
 * with a category column does not make it answerable, it makes it filterable,
 * which is a thing you have to already know the answer to do.
 *
 * Empty categories are left out. A heading over nothing is not information
 * about the firm, it is the taxonomy talking about itself.
 */
export function ProviderGroups({ rows }: { rows: ProviderRow[] }) {
  const groups = new Map<string, ProviderRow[]>();
  for (const row of rows) {
    const key = row.category ?? "No category";
    const held = groups.get(key);
    if (held) held.push(row);
    else groups.set(key, [row]);
  }

  // Alphabetical, but anything unclassified last: it is a pile to work
  // through rather than a category anybody looks under.
  const ordered = [...groups.entries()].sort(([a], [b]) => {
    if (a === "No category") return 1;
    if (b === "No category") return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col gap-4">
      {ordered.map(([category, people]) => (
        <div
          key={category}
          className="rounded-[10px] border border-line"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="flex items-baseline justify-between gap-3 border-b px-4 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="text-[11.5px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {category}
            </span>
            <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
              {people.length}
            </span>
          </div>

          <div className="flex flex-col">
            <ShowMore>
            {people.map((provider, index) => (
              <div
                key={provider.id}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-soft)]"
                style={{
                  borderTop: index === 0 ? undefined : "1px solid var(--border)",
                  color: "var(--ink)",
                }}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center text-[11px] font-bold ${
                    provider.type === "Company" ? "rounded-[8px]" : "rounded-full"
                  }`}
                  style={
                    provider.type === "Company"
                      ? { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }
                      : { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" }
                  }
                >
                  {initialsOf(provider.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">{provider.name}</span>
                  <span className="block truncate text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    {provider.type}
                    {provider.clientName ? ` · ${provider.clientName}` : ""}
                  </span>
                </span>
                <span
                  className="hidden w-[130px] shrink-0 truncate text-[12.5px] md:block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {provider.ownerName ?? "Unassigned"}
                </span>
                <span className="shrink-0">
                  <Pill tone={readinessTone(provider.readiness)}>
                    {readinessLabel(provider.readiness)}
                  </Pill>
                </span>
                {/* The same control the table row carries, so a provider is
                    opened the same way whichever way the list is read. */}
                <Link
                  href={`/whitbyos/providers/${provider.id}`}
                  className="shrink-0 rounded-control border px-2.5 py-[5px] text-[12.5px] font-medium no-underline transition-colors hover:bg-[var(--surface)]"
                  style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
                >
                  View
                </Link>
              </div>
            ))}
            </ShowMore>
          </div>
        </div>
      ))}
    </div>
  );
}
