import { Pill } from "@/base/components/Pill";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import type { PlanTask, TaskResource } from "@/whitbyos/lib/work-plans";

/**
 * Every place this plan sends somebody, gathered in one list.
 *
 * Whitby works these out per task, and they used to live only inside the Edit
 * dialog for that task — so on a plan about a lost passport, the consulate's
 * number was three clicks away from the person who needed to dial it. On a
 * plan that is urgent, a number nobody can find is a number that does not
 * exist.
 *
 * Emergency and authority first, because when this list matters at all, that
 * is the part that matters. A detail Whitby could not check against a source
 * is marked rather than dropped: an unverified number is worth having and is
 * not worth trusting, and only saying so makes both true at once.
 */

/**
 * Emergency first, then the firm's own people, then the rest.
 *
 * A provider outranks an authority here because it is the firm's own record —
 * screened, and with a number somebody at this desk has already dialled. A
 * government switchboard found by searching is the fallback, not the first
 * call.
 */
const ORDER: TaskResource["kind"][] = [
  "emergency",
  "provider",
  "authority",
  "booking",
  "contact",
  "website",
];

const KIND_LABEL: Record<string, string> = {
  emergency: "Emergency",
  authority: "Authority",
  booking: "Booking",
  provider: "Provider",
  contact: "Contact",
  website: "Website",
};

type Entry = { resource: TaskResource; tasks: string[] };

export function planResources(tasks: PlanTask[]): Entry[] {
  // The same consulate turns up on three steps; it is one entry with three
  // steps behind it, not the same number printed three times.
  const byKey = new Map<string, Entry>();

  for (const task of tasks) {
    for (const resource of task.externalLinks ?? []) {
      if (!resource?.label) continue;

      const key = [
        resource.label.trim().toLowerCase(),
        resource.phone ?? "",
        resource.email ?? "",
        resource.url ?? "",
      ].join("|");

      const found = byKey.get(key);
      if (found) {
        if (!found.tasks.includes(task.title)) found.tasks.push(task.title);
        continue;
      }

      byKey.set(key, { resource, tasks: [task.title] });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const rank = ORDER.indexOf(a.resource.kind) - ORDER.indexOf(b.resource.kind);
    if (rank !== 0) return rank;

    // Then whichever can actually be reached. This panel is called "Where to
    // go", and a name with no number and no link does not send anybody
    // anywhere — it is worth keeping, because knowing which authority's rules
    // apply is worth knowing, but it is not what somebody opened this for.
    const reach = Number(worthMarking(b.resource)) - Number(worthMarking(a.resource));
    if (reach !== 0) return reach;

    return a.resource.label.localeCompare(b.resource.label);
  });
}

/**
 * One, and then a way to ask for the rest.
 *
 * A plan of forty tasks can name a dozen places to go, and a rail that runs
 * twelve of them deep pushes everything under it off the screen — which on
 * this panel means the emergency number is visible and the reason anybody
 * scrolled is not. One is what the panel is for: the one the sort has
 * already decided matters most, with the rest one press away.
 *
 * The rows are rendered here rather than handed to `ShowMore` because they
 * are this component's own; the behaviour is the same one the Providers
 * directory uses.
 */
export function ContactsPanel({ entries }: { entries: Entry[] }) {
  return (
    <div className="flex flex-col gap-3">
      <ShowMore step={1}>
        {entries.map((entry, index) => (
          <Resource key={index} entry={entry} />
        ))}
      </ShowMore>
    </div>
  );
}

function Resource({ entry }: { entry: Entry }) {
  const { resource, tasks } = entry;
  const urgent = resource.kind === "emergency";

  return (
    <div
      className="flex flex-col gap-1 leading-[1.5]"
      style={
        urgent
          ? {
              // The one kind that earns a mark of its own. A stripe rather
              // than a box: it sits in a list of siblings and has to read as
              // the same kind of thing, only first.
              borderLeft: "2px solid var(--danger-fg)",
              paddingLeft: "9px",
              marginLeft: "-11px",
            }
          : undefined
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="text-[9.5px] font-semibold uppercase tracking-[.05em]"
          style={{ color: urgent ? "var(--danger-fg)" : "var(--text-quiet)" }}
        >
          {KIND_LABEL[resource.kind] ?? resource.kind}
        </span>
        <span className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
          {resource.label}
        </span>
        {/* "Unverified" read as a fault in the system rather than a fact about
            the detail — it had to be explained every time it appeared. This
            says what to do with it instead of grading whatever produced it. */}
        {resource.verified !== true && worthMarking(resource) ? (
          <span title="Whitby named this from its own knowledge rather than from a search result. Confirm it before you rely on it.">
            <Pill tone="neutral">Check before use</Pill>
          </span>
        ) : null}
      </div>

      {/* A number worth reading in a hurry is worth reading at full size, on
          its own line, with the digits lined up. */}
      {resource.phone ? (
        <a
          href={`tel:${resource.phone.replace(/[^\d+]/g, "")}`}
          className="text-[13px] font-medium no-underline"
          style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}
        >
          {resource.phone}
        </a>
      ) : null}

      {resource.email ? (
        <a
          href={`mailto:${resource.email}`}
          className="break-all text-[12px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          {resource.email}
        </a>
      ) : null}

      {resource.url ? (
        <a
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-[12px] no-underline"
          style={{ color: "var(--accent)" }}
        >
          {shortUrl(resource.url)}
        </a>
      ) : null}

      {resource.address ? (
        <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {resource.address}
        </span>
      ) : null}

      {/* Which step needs it, so the list is navigable rather than a directory
          of numbers with no reason attached. */}
      <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
        {tasks.length === 1 ? tasks[0] : `${tasks[0]} and ${tasks.length - 1} more`}
      </span>
    </div>
  );
}

/**
 * Whether the mark means anything on this one.
 *
 * "Unverified" is a warning about a detail that could be wrong in a way that
 * costs somebody something: a number that gets dialled, an address somebody
 * drives to, a link they follow. A resource that is only a name — "Advertising
 * Standards Authority (ASA) guidance" — carries nothing to be wrong about, so
 * the mark says nothing and three of them in a column say it loudly.
 */
function worthMarking(resource: TaskResource): boolean {
  return Boolean(resource.phone || resource.email || resource.url || resource.address);
}

/** The host and the first part of the path; the query string helps nobody. */
function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.host}${path}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

/**
 * The numbers to ring when something has gone wrong, wherever you are.
 *
 * "Where to go" lives on the List's rail, and Kanban, Timeline and Charts have
 * no rail at all — so on a plan about a lost passport, whether the consulate's
 * number was on screen depended on which tab you happened to be looking at.
 * An emergency line is not a rail item. This sits in the plan's header, above
 * the views, so it is on every one of them.
 */
export function EmergencyStrip({ entries }: { entries: Entry[] }) {
  const urgent = entries.filter(
    (entry) => entry.resource.kind === "emergency" && (entry.resource.phone || entry.resource.url),
  );

  if (urgent.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[8px] px-3 py-2.5"
      style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-action-border)" }}
    >
      <span
        className="text-[10.5px] font-semibold uppercase tracking-[.06em]"
        style={{ color: "var(--danger-fg)" }}
      >
        In an emergency
      </span>

      {urgent.map((entry, index) => (
        <span key={index} className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[12.5px]" style={{ color: "var(--ink)" }}>
            {entry.resource.label}
          </span>
          {entry.resource.phone ? (
            <a
              href={`tel:${entry.resource.phone.replace(/[^\d+]/g, "")}`}
              className="text-[13.5px] font-semibold no-underline"
              style={{ color: "var(--danger-fg)", fontVariantNumeric: "tabular-nums" }}
            >
              {entry.resource.phone}
            </a>
          ) : null}
          {entry.resource.verified === true ? null : (
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              check first
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
