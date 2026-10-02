import { Button } from "@/base/components/Button";
import { whenLine } from "@/whitbyos/lib/calendar-format";
import { Modal } from "@/client-portal/components/Modal";
import { BUTTON_SIZE } from "@/client-portal/components/buttons";
import type { CalendarItem } from "@/client-portal/types";
import { KindPill } from "./EventRow";
import { sourceLabel } from "./vocab";

/**
 * One event — Whitby's Screen 8.1, read-only.
 *
 * The client does not edit what the team scheduled, and their own events are
 * changed in the calendar they came from, so where Whitby has a form this has
 * the facts and the one place each can be acted on.
 */
export function EventDetail({
  item,
  timeZone,
  closeHref,
}: {
  item: CalendarItem;
  timeZone: string;
  closeHref: string;
}) {
  const attendees = (item.attendees ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const facts: [string, React.ReactNode][] = [
    ["When", whenLine(item.startAt, item.endAt, item.allDay, timeZone)],
    ["Type", <KindPill key="kind" item={item} />],
    ...(item.location ? ([["Where", item.location]] as [string, React.ReactNode][]) : []),
    // Who else is coming. Whitby keeps them as one typed line, so they are
    // split back into names rather than shown as the comma string somebody
    // happened to type — and the reader's own name is not among them on
    // either side.
    ...(attendees.length > 0
      ? ([["Who", <Attendees key="who" names={attendees} />]] as [string, React.ReactNode][])
      : []),
    ...(item.requestTitle ? ([["Request", item.requestTitle]] as [string, React.ReactNode][]) : []),
    ["From", sourceLabel(item)],
  ];

  const primary = item.requestId
    ? { href: `/client-portal/requests/${item.requestId}`, label: "Open request" }
    : item.personal?.href
      ? { href: item.personal.href, label: "Open in Google Calendar" }
      : null;

  return (
    <Modal title={item.title} closeHref={closeHref} width={480}>
      <dl className="flex flex-col gap-3 text-[13.5px]">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-4">
            <dt className="w-[72px] shrink-0 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {label}
            </dt>
            <dd className="min-w-0 flex-1 break-words" style={{ color: "var(--ink)" }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-7 flex justify-end gap-2.5">
        <Button unsized href={closeHref} variant="secondary" className={BUTTON_SIZE.form}>
          Close
        </Button>
        {primary ? (
          <Button unsized href={primary.href} variant="primary" className={BUTTON_SIZE.form}>
            {primary.label}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * The names on an event, one per line.
 *
 * A meeting with four people in it reads as a list, not as a sentence with
 * commas in it — and a name that wraps stays one name.
 */
function Attendees({ names }: { names: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {names.map((name) => (
        <li key={name} className="break-words">
          {name}
        </li>
      ))}
    </ul>
  );
}
