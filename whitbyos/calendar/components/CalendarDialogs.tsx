import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { AttendeePicker } from "@/whitbyos/calendar/components/AttendeePicker";
import { CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import { createEvent, saveEvent, unlinkEvent } from "@/whitbyos/calendar/actions";
import {
  CALENDARS,
  EVENT_KIND,
  calendarLabel,
  eventChip,
  sourceColor,
  sourceGlyph,
} from "@/whitbyos/lib/calendar-vocab";
import { whenLine } from "@/whitbyos/lib/calendar-format";
import { GOOGLE_PROVIDER, googleEventUrl } from "@/whitbyos/lib/google-calendar";
import type { CalendarEvent } from "@/whitbyos/lib/calendar";

type RequestOption = { id: string; title: string; clientName?: string | null };
type ClientOption = { id: string; name: string };

/**
 * Screen 8c — New Event.
 *
 * "Save To" is the field that makes the rest of it real. The reference lists
 * every calendar Whitby knows about and greys out the ones not connected, so
 * the professional sees at the moment of creating an event where it will end
 * up — rather than discovering afterwards that it never left Whitby.
 */
export function NewEventDialog({
  requests,
  clients,
  people,
  defaultDate,
  connected,
  closeHref,
  error,
}: {
  requests: RequestOption[];
  clients: ClientOption[];
  /**
   * Who could be in the room: this client's contacts, the firm's own people,
   * and the providers on the work. Attendees is free text — a meeting can have
   * somebody in it who is in none of Whitby's lists — so these are offered
   * rather than imposed.
   */
  people: { name: string; detail: string | null }[];
  defaultDate: string;
  connected: string[];
  closeHref: string;
  error?: string;
}) {
  const destination = connected[0] ?? "";

  return (
    <Modal
      title="New Event"
      closeHref={closeHref}
      width={560}
      // 8c's own values: an 18px "×", 16px under the header rather than 18,
      // and a slightly lighter scrim than 8.1 draws.
      closeGlyph="×"
      closeSize={18}
      headerGap={16}
      scrim="rgba(55,53,47,.4)"
    >
      <form action={createEvent} className="flex flex-col gap-4">
        <input type="hidden" name="back" value={closeHref} />

        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Title" htmlFor="title">
          <input
            id="title"
            name="title"
            required
            placeholder="Enter the title"
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          />
        </Field>

        <div className="flex gap-3">
          <Field label="Date" htmlFor="date" className="flex-1">
            <input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            />
          </Field>

          <Field label="Time" htmlFor="time" className="flex-1">
            <input
              id="time"
              name="time"
              type="time"
              defaultValue="09:00"
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            />
          </Field>
        </div>

        <Field label="Type" htmlFor="kind">
          <select
            id="kind"
            name="kind"
            defaultValue="appointment"
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          >
            {EVENT_KIND.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {/*
         * What the meeting is about, and whose it is.
         *
         * Two fields, and the second was labelled for the first: "Client (if
         * no Request)" made somebody work out what the answer above had
         * already decided. A Request names its own client, so choosing one
         * answers both — and with a client workspace open there is nothing to
         * ask at all, which is the usual case.
         */}
        <Field label="About a Request (optional)" htmlFor="request_id">
          <select
            id="request_id"
            name="request_id"
            defaultValue=""
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          >
            <option value="">None</option>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {/* Linking to a Request also links the event to that Request's
                    client, so the option says which one rather than leaving it
                    to be discovered after the event exists. */}
                {request.clientName ? `${request.title}, ${request.clientName}` : request.title}
              </option>
            ))}
          </select>
        </Field>

        {/* For an event that belongs to a client but to no one Request. A
            Request, when one is picked above, decides the client itself. */}
        {clients.length === 1 ? (
          /* The workspace that is open: said once, not asked. */
          <input type="hidden" name="client_id" value={clients[0].id} />
        ) : (
          <Field label="Whose it is, where no Request says" htmlFor="client_id">
            <select
              id="client_id"
              name="client_id"
              defaultValue=""
              className={`${CONTROL_UNSIZED} text-[13.5px]`}
            >
              <option value="">Nobody in particular</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <VisibleToClient defaultChecked={false} />

        <Field label="Attendees" htmlFor="attendees">
          <AttendeePicker people={people} />
        </Field>

        <Field label="Save To" htmlFor="save_to">
          <select
            id="save_to"
            name="save_to"
            defaultValue={destination}
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          >
            {/* Without a calendar connected every option would be disabled and
                the form could not be submitted, so Whitby holds it instead. */}
            {connected.length === 0 ? (
              <option value="">Whitby, no calendar connected</option>
            ) : null}

            {CALENDARS.map((calendar) => {
              const on = connected.includes(calendar.value);
              return (
                <option key={calendar.value} value={calendar.value} disabled={!on}>
                  {calendar.label} ({on ? "connected" : "not connected"})
                </option>
              );
            })}
          </select>
        </Field>

        <div className="mt-2 flex justify-end gap-2.5">
          <Button
            href={closeHref}
            variant="secondary"
            unsized
            className="px-4 py-[9px] text-[13.5px]"
          >
            Cancel
          </Button>
          <Submit variant="primary" unsized className="px-4 py-[9px] text-[13.5px]">
            Create Event
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Screen 8.1 — one event.
 *
 * The line about which calendar owns it is the point of the screen rather than
 * a footnote: §11.2 makes a connected calendar authoritative, so the
 * professional needs to know whether they are looking at something Whitby
 * holds or something Google does before they change it. Saving sends the
 * change to Google first and writes here only if Google took it.
 *
 * Title, Type and Attendees are the drawn values, editable in place — at rest
 * they read exactly as the reference draws them, and "Save Changes" has
 * something to save.
 */
export function EventDetailDialog({
  event,
  requests,
  clients,
  people,
  timezone,
  googleAccount,
  closeHref,
  error,
}: {
  event: CalendarEvent;
  requests: RequestOption[];
  clients: ClientOption[];
  /** Who could be in the room, for the Attendees picker's suggestions. */
  people: { name: string; detail: string | null }[];
  timezone: string;
  googleAccount: string | null;
  closeHref: string;
  error?: string;
}) {
  const source = calendarLabel(event.externalCalendar);
  const trail = [event.requestTitle, event.clientName].filter(Boolean).join(" / ");
  const chip = eventChip(event.kind);

  const openInGoogle =
    event.externalCalendar === GOOGLE_PROVIDER && event.externalEventId
      ? googleEventUrl(event.externalEventId, googleAccount)
      : null;

  const when = whenLine(event.start_at, event.end_at, event.allDay, timezone);

  return (
    <Modal
      title={event.title}
      eyebrow={trail || "Not linked to a request"}
      closeHref={closeHref}
      width={560}
      dense
      bareHeader
    >
      <form action={saveEvent}>
        <input type="hidden" name="back" value={closeHref} />
        <input type="hidden" name="event_id" value={event.id} />

        {error ? (
          <div className="mb-3">
            <Callout tone="danger">{error}</Callout>
          </div>
        ) : null}

        <input
          name="title"
          defaultValue={event.title}
          aria-label="Event title"
          required
          className="my-1.5 w-full rounded-[3px] border-0 bg-transparent p-0 text-[19px] font-bold outline-none focus:outline-none"
          style={{ color: "var(--ink)" }}
        />

        <div className="mb-[18px] text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {when}
          {event.location ? ` · ${event.location}` : ""}
        </div>

        <div className="mb-[18px] grid grid-cols-2 gap-x-5 gap-y-3.5">
          <Detail label="Linked Request">
            {event.requestId ? (
              <>
                <input type="hidden" name="request_id" value={event.requestId} />
                <Link href={`/whitbyos/requests/${event.requestId}`} className="no-underline">
                  {event.requestTitle}
                </Link>
              </>
            ) : (
              <select
                name="request_id"
                defaultValue=""
                aria-label="Link to Request"
                className="w-full cursor-pointer border-0 bg-transparent p-0 text-[13.5px] outline-none"
                style={{ color: "var(--accent)" }}
              >
                <option value="">Not linked</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.title}
                  </option>
                ))}
              </select>
            )}
          </Detail>

          <Detail label="Linked Client">
            {event.requestId && event.clientId ? (
              // A Request decides its own client; this is shown, not chosen.
              <Link href={`/whitbyos/clients/${event.clientId}`} className="no-underline">
                {event.clientName}
              </Link>
            ) : (
              <select
                name="client_id"
                defaultValue={event.clientId ?? ""}
                aria-label="Linked Client"
                className="w-full cursor-pointer border-0 bg-transparent p-0 text-[13.5px] outline-none"
                style={{ color: "var(--accent)" }}
              >
                <option value="">Not set</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            )}
          </Detail>

          <Detail label="Type">
            <select
              name="kind"
              defaultValue={event.kind}
              aria-label="Type"
              className="w-fit cursor-pointer appearance-none rounded border-0 px-[7px] py-[2px] text-[10.5px] font-medium outline-none"
              style={chip}
            >
              {EVENT_KIND.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Detail>

          <Detail label="Attendees">
            {/* The same picker New Event uses, so a name is added the same way
                wherever an event is being written. */}
            <AttendeePicker people={people} initial={event.attendees} />
          </Detail>

          {/*
            The reference has no control for this on any Calendar screen, and
            §13.5.3 is emphatic that an internal deadline is never surfaced to a
            client on its own, so without one, every event stays internal for
            ever and the portal's calendar can only ever be empty.

            It sits here rather than on 8c because this is the screen with a
            Save, and because the decision is worth making with the event in
            front of you rather than while typing its title.
          */}
          <Detail label="Visible to client">
            {/* Was locked behind "Link a Request first", so an event for a
                client with no Request could never be shared. Either route to
                a client is enough; the action drops the flag if neither is set. */}
            <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
              <input
                type="checkbox"
                name="client_visible"
                value="1"
                defaultChecked={event.clientVisible}
                className="h-[14px] w-[14px]"
                style={{ accentColor: "var(--accent)" }}
              />
              Shows in their portal
            </label>
          </Detail>
        </div>

        <div className="mb-[22px] flex items-center gap-2 border-t border-line pt-3.5">
          <span
            className="w-[15px] shrink-0 text-[11px]"
            style={{ color: sourceColor(event.kind, event.externalCalendar) }}
            aria-hidden
          >
            {sourceGlyph(event.kind)}
          </span>
          <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            {source ? (
              <>
                Managed in <strong style={{ color: "var(--ink)", fontWeight: 600 }}>{source}</strong>{" "}
               , this is the source of truth. Edits here sync back; the connected calendar always
                remains authoritative.
              </>
            ) : (
              <>
                Held in <strong style={{ color: "var(--ink)", fontWeight: 600 }}>Whitby</strong>. Nothing
                outside has a copy of it. Connect a calendar and events like this one sync
                outward.
              </>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-2.5">
          {openInGoogle ? (
            <a
              href={openInGoogle}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              Open in {source} ↗
            </a>
          ) : (
            <span />
          )}

          <div className="flex gap-2.5">
            {event.requestId ? (
              // Same form, its own action — nesting a second <form> here would
              // be invalid markup and the browser would drop it.
              <button
                type="submit"
                formAction={unlinkEvent}
                className="inline-flex items-center justify-center rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium"
                style={{ background: "var(--surface)", color: "var(--ink)" }}
              >
                Unlink from Request
              </button>
            ) : null}

            <Submit
             
              variant="primary"
              unsized
              className="px-[18px] py-[9px] text-[13.5px]"
            >
              Save Changes
            </Submit>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/**
 * §13.5.3: nothing reaches a client unless somebody says so, so this starts
 * unticked. It needs a client to mean anything — through the Request, or named
 * directly — and the action ignores it without one.
 */
function VisibleToClient({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-2 text-[13px]" style={{ color: "var(--ink)" }}>
      <input
        type="checkbox"
        name="client_visible"
        value="1"
        defaultChecked={defaultChecked}
        className="mt-[3px]"
        style={{ accentColor: "var(--accent)" }}
      />
      <span>
        Visible to the client
        <span className="block text-[11.5px] leading-[1.4]" style={{ color: "var(--text-tertiary)" }}>
          Shows on their portal calendar. Needs a Request or a client above.
        </span>
      </span>
    </label>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-[5px] text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </div>
      <div className="text-[13.5px]">{children}</div>
    </div>
  );
}
