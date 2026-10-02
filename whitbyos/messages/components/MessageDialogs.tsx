import { Button } from "@/base/components/Button";
import { Submit, SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import {
  deleteThread,
  removeGroupPhoto,
  setThreadArchived,
  createThread,
  linkThreadToRequest,
  saveConversation,
  startDirect,
} from "@/whitbyos/messages/actions";
import type { Person, Recipient } from "@/whitbyos/lib/messages";
import { GroupPicture } from "@/whitbyos/messages/components/GroupPicture";
import { GroupPeoplePicker } from "@/whitbyos/messages/components/GroupPeoplePicker";
import { GroupPeopleSettings } from "@/whitbyos/messages/components/GroupPeopleSettings";
import { AddParticipantDialog } from "@/whitbyos/messages/components/AddParticipantDialog";

export { AddParticipantDialog };

type Option = { id: string; title: string };

/**
 * Screen 9.5 — New Group.
 *
 * Participants are checkboxes over one list of the people who can actually be
 * written to: a client's contacts, providers, and your own teammates. Each is
 * labelled by kind because the channel differs — a teammate is reached inside
 * Whitby, a client contact through the portal — and client contacts and
 * providers never share a group.
 */
export function NewThreadDialog({
  requests,
  recipients,
  kind,
  scopeName,
  closeHref,
  error,
}: {
  requests: Option[];
  recipients: Recipient[];
  kind: "direct" | "group";
  /** The client workspace that is open, whose people these are. */
  scopeName?: string | null;
  closeHref: string;
  error?: string;
}) {
  const group = kind === "group";

  return (
    <Modal title={group ? "New Group" : "New Message"} closeHref={closeHref} width={480} dense>
      <form action={createThread} className="flex flex-col">
        <input type="hidden" name="kind" value={kind} />

        {scopeName ? (
          <p className="mb-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            People in {scopeName} and your own team. Choose All clients on
            Workspace Overview to reach anybody else.
          </p>
        ) : null}

        {error ? (
          <div className="mb-4">
            <Callout tone="danger">{error}</Callout>
          </div>
        ) : null}

        <SmallField label={group ? "Group name" : "Subject"} htmlFor="subject">
          <input
            id="subject"
            name="subject"
            required
            placeholder={
              group ? "Enter a group name" : "Enter a subject"
            }
            className={SMALL_CONTROL}
          />
        </SmallField>

        <SmallField label="Link to a Request (optional)" htmlFor="request_id">
          <select id="request_id" name="request_id" defaultValue="" className={SMALL_CONTROL}>
            <option value="">None</option>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </SmallField>

        <div className="mb-[18px]">
          <span
            className="mb-2 block text-[12px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            {group ? "Participants" : "To"}
          </span>

          {group ? (
            <GroupPeoplePicker recipients={recipients} multiple />
          ) : recipients.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              No one to add yet. Contacts linked to a client, providers, and
              teammates appear here.
            </p>
          ) : (
            <div className="flex max-h-[220px] flex-col overflow-auto">
              {GROUPS.map((section) => {
                const people = recipients.filter((person) => person.kind === section.kind);
                if (people.length === 0) return null;

                return (
                  <div key={section.kind} className="mb-2 last:mb-0">
                    <span
                      className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-[.05em]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      {section.label}
                    </span>

                    {people.map((person) => (
                      <label
                        key={`${person.kind}-${person.id}`}
                        className="flex items-center gap-2.5 rounded-control px-1 py-2 text-[13.5px] hover:bg-[var(--surface-soft)]"
                      >
                        <input
                          type="radio"
                          name="contact_id"
                          value={`${person.kind}:${person.id}`}
                          className="h-[15px] w-[15px]"
                          style={{ accentColor: "var(--accent)" }}
                        />
                        <PickerFace name={person.name} photo={person.photo} size={26} />
                        <span className="min-w-0 flex-1 truncate">{person.name}</span>
                        {saysWho(person) ? (
                          <span
                            className="shrink-0 text-[11.5px]"
                            style={{ color: "var(--text-tertiary)" }}
                          >
                            {saysWho(person)}
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <SmallField label="Starting message (optional)" htmlFor="body">
          <textarea
            id="body"
            name="body"
            placeholder={group ? "Say what this group is for" : "Write the first message"}
            className={`${SMALL_CONTROL} min-h-[64px] resize-y`}
          />
        </SmallField>

        <p className="mb-[18px] text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {recipients.some((person) => person.kind === "contact")
            ? "Teammates see this in Whitby, and a client contact sees it in their portal once they have access."
            : "Teammates see this in Whitby."}
          {group
            ? " Client contacts and providers cannot be in the same group. Anyone added later sees the conversation from the point they join."
            : ""}
        </p>

        <div className="flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
            {group ? "Create Group" : "Send"}
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/** 9.5 labels its fields at 12px in secondary, tighter than the plan dialogs. */
const SMALL_CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink placeholder:text-[rgba(55,53,47,0.35)]";

function SmallField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Screen 9.1 — Add to Request.
 *
 * §2.5 keeps this distinct from Quick Add and keeps the source record intact:
 * linking a conversation to a Request never copies it there, so the thread
 * stays what it was and gains a place in the work.
 */
export function AddToRequestDialog({
  threadId,
  subject,
  requests,
  current,
  currentTitle,
  newHref,
  direct,
  closeHref,
}: {
  threadId: string;
  /** Named in the copy, so it is clear which conversation is being linked. */
  subject: string;
  requests: Option[];
  current: string | null;
  /** What it is filed under now, said in words rather than as an id. */
  currentTitle?: string | null;
  /** Where to go to start a conversation about other work instead. */
  newHref?: string;
  /** A conversation with one person behaves differently here — see below. */
  direct?: boolean;
  closeHref: string;
}) {
  /* On a direct conversation this picker opens a conversation rather than
     moving one, whichever way it is pointed — "Not linked" included. */
  const opensAnother = Boolean(direct);
  return (
    <Modal
      title={direct ? "Which conversation" : current ? "Change Request" : "Add to Request"}
      closeHref={closeHref}
      width={480}
      dense
      titleSize={17}
      headerGap={16}
    >
      {/*
       * What it does, rather than what it might one day do.
       *
       * This used to promise that "Whitby may suggest a resulting Task, Note,
       * or date after this is linked". Nothing suggests anything after linking,
       * and a dialog that describes a feature the product does not have teaches
       * people to stop reading the dialogs.
       */}
      {opensAnother ? null : (
        <p className="mb-[18px] text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          &ldquo;{subject}&rdquo; is filed under the Request, and under the client it
          belongs to. It is listed on the Request&rsquo;s own Messages tab, shows up
          here under By Request, carries the Request&rsquo;s name in the list and on
          the client&rsquo;s own copy, and a Task made from it starts out on that
          Request.
        </p>
      )}

      {/*
       * Re-filing moves the past with it.
       *
       * A conversation is filed under one Request, so pointing it at another
       * takes everything already said under that other Request. That is the
       * right answer for a mistake and the wrong one for new work, and the
       * difference is worth a sentence before the press rather than a
       * discovery afterwards.
       */}
      {opensAnother || current ? (
        <div
          className="mb-[18px] rounded-[8px] px-3.5 py-3 text-[12.5px] leading-[1.6]"
          style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
        >
          {current ? (
            <>
              Filed under{" "}
              <strong style={{ color: "var(--ink)" }}>{currentTitle ?? "a Request"}</strong>.{" "}
            </>
          ) : (
            <>Filed under nothing in particular. </>
          )}
          {opensAnother ? (
            <>
              Choosing here opens your conversation with this person about that
              work, and starts one where there is none. Not linked is the
              general one. This conversation stays where it is, with everything
              already said in it.
            </>
          ) : (
            <>
              Changing it moves everything already said here under the new one.
              {newHref ? (
                <>
                  {" "}To talk about different work, start a{" "}
                  <a href={newHref} style={{ color: "var(--accent)" }}>
                    new conversation
                  </a>{" "}
                  instead, as each Request keeps its own.
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <form action={linkThreadToRequest} className="flex flex-col gap-4">
        <input type="hidden" name="thread_id" value={threadId} />

        <Field label="Request" htmlFor="request_id">
          <select
            id="request_id"
            name="request_id"
            defaultValue={current ?? ""}
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          >
            <option value="">{direct ? "Nothing in particular" : "Not linked"}</option>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            {opensAnother ? "Open that conversation" : "Link to Request"}
          </Submit>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Putting a conversation away, and bringing it back.
 *
 * Messages' own archive, not the workspace one: it leaves the rail and is read
 * from Archived beside it. Worth one sentence rather than a silent action,
 * because "archive" means destruction to enough people to be worth denying.
 */
export function ArchiveConversationDialog({
  threadId,
  subject,
  archived,
  closeHref,
}: {
  threadId: string;
  subject: string;
  archived: boolean;
  closeHref: string;
}) {
  return (
    <Modal
      title={archived ? `Bring back "${subject}"?` : `Archive "${subject}"?`}
      closeHref={closeHref}
      width={440}
      dense
    >
      <p className="mb-5 text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        {archived
          ? "It goes back to the conversation list, where it was."
          : "It leaves the list and is read from Archived beside it. Nothing is deleted, everyone on it keeps what was said, and a new reply brings it back on its own."}
      </p>

      <form action={setThreadArchived} className="flex justify-end gap-2.5">
        <input type="hidden" name="thread_id" value={threadId} />
        <input type="hidden" name="archived" value={archived ? "0" : "1"} />
        <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
          Cancel
        </Button>
        <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
          {archived ? "Bring it back" : "Archive"}
        </Submit>
      </form>
    </Modal>
  );
}

/**
 * Deleting a group, which is the one thing in Messages that does not come
 * back — so it says what it takes with it before it takes it.
 */
export function DeleteGroupDialog({
  threadId,
  subject,
  messageCount,
  peopleCount,
  closeHref,
}: {
  threadId: string;
  subject: string;
  messageCount: number;
  peopleCount: number;
  closeHref: string;
}) {
  return (
    <Modal title={`Delete "${subject}"?`} closeHref={closeHref} width={440} dense>
      <p className="mb-3.5 text-[13px] leading-[1.6]" style={{ color: "var(--text-secondary)" }}>
        This removes the group for everyone on it, along with everything said in
        it. It cannot be undone.
      </p>

      <div
        className="mb-5 rounded-[8px] px-3.5 py-3 text-[12.5px] leading-[1.7]"
        style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
      >
        {messageCount} {messageCount === 1 ? "message" : "messages"} · {peopleCount}{" "}
        {peopleCount === 1 ? "person" : "people"} on it
        <span className="mt-1 block" style={{ color: "var(--text-tertiary)" }}>
          To keep the record, archive it instead.
        </span>
      </div>

      <form action={deleteThread} className="flex justify-end gap-2.5">
        <input type="hidden" name="thread_id" value={threadId} />
        <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
          Cancel
        </Button>
        <SubmitPlain
          className="rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white"
          style={{ background: "var(--danger-solid)" }}
        >
          Delete group
        </SubmitPlain>
      </form>
    </Modal>
  );
}

/** How each participant kind is described where the settings panel lists them. */
const PERSON_KIND: Record<Person["kind"], string> = {
  teammate: "Your team",
  contact: "Client contact",
  provider: "Provider",
};

/**
 * Screen 9.4c — the conversation's own settings.
 *
 * One panel and one form for name and picture. Removing somebody is its own
 * client action outside that form — otherwise Save's spinner lit on every
 * Remove and the redirect reloaded the whole Messages screen.
 */
export function ConversationSettingsDialog({
  thread,
  people,
  recipients,
  linkHref,
  archiveHref,
  deleteHref,
  closeHref,
  error,
}: {
  thread: {
    id: string;
    subject: string;
    kind: "direct" | "group";
    requestTitle: string | null;
    archived: boolean;
    /** Its own picture, where somebody has given it one. */
    photo: string | null;
    /** Whoever made the group, and whoever owns the workspace. */
    canDelete: boolean;
  };
  people: Person[];
  /** Who can still be offered on Add people. */
  recipients: Recipient[];
  linkHref: string;
  archiveHref: string;
  deleteHref: string;
  closeHref: string;
  error?: string;
}) {
  const group = thread.kind === "group";

  /*
   * A conversation with one person has almost nothing to set.
   *
   * Its name is their name — renaming it here would rename them on this
   * screen and nowhere else, which is a field that lies. Adding somebody is
   * starting a group, which is done from New Group. What is left is the work
   * it is filed under and putting it away, so that is the whole panel.
   */
  if (!group) {
    const them = people[0] ?? null;

    return (
      <Modal title="Conversation settings" closeHref={closeHref} width={460} dense>
        {error ? (
          <div className="mb-4">
            <Callout tone="danger">{error}</Callout>
          </div>
        ) : null}

        <div className="flex items-center gap-3.5">
          <PickerFace name={them?.name ?? thread.subject} photo={them?.photo} size={54} />
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold">
              {them?.name ?? thread.subject}
            </div>
            <div className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {them ? PERSON_KIND[them.kind] : "Conversation"}
            </div>
          </div>
        </div>

        <Rule />

        <SectionLabel>Filed under</SectionLabel>
        <div
          className="flex items-center justify-between gap-3 rounded-[10px] border px-3.5 py-2.5"
          style={{ borderColor: "var(--chrome-line)", background: "var(--surface-soft)" }}
        >
          <span
            className="min-w-0 truncate text-[13px]"
            style={{ color: thread.requestTitle ? "var(--ink)" : "var(--text-tertiary)" }}
          >
            {thread.requestTitle ?? "No Request"}
          </span>
          <Button unsized href={linkHref} variant="secondary" className="shrink-0 px-3 py-[5px] text-[12.5px]">
            {thread.requestTitle ? "Change" : "Add to Request"}
          </Button>
        </div>

        <p className="mt-2.5 text-[12px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
          Each Request keeps its own thread inside your conversation with{" "}
          {them ? them.name.split(/\s+/)[0] : "this person"}. Only the two of you
          can see it.
        </p>

        <Rule />

        <div className="flex items-center justify-between gap-3">
          <Button unsized href={archiveHref} variant="secondary" className="px-3.5 py-[7px] text-[12.5px]">
            {thread.archived ? "Bring it back" : "Archive"}
          </Button>
          <Button unsized href={closeHref} variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={group ? "Group settings" : "Conversation settings"}
      closeHref={closeHref}
      width={520}
      dense
    >
      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {/* No encType: React sets it for a server action, and saying it here
          is overridden with a console error. Files post fine without it. */}
      <form action={saveConversation} className="flex flex-col">
        <input type="hidden" name="thread_id" value={thread.id} />

        {/* Its face and its name on one line, the way a group is shown
            anywhere it is shown at all. A client piece, so the picture just
            chosen is drawn before it has been uploaded — choosing one used to
            change nothing on screen until the panel was saved and reloaded,
            which reads as a control that did not work. */}
        <GroupPicture
          name={thread.subject}
          photo={thread.photo}
          initials={initials(thread.subject)}
          removeAction={thread.photo ? removeGroupPhoto : undefined}
        />

        <Rule />

        <SectionLabel>Filed under</SectionLabel>
        <div
          className="flex items-center justify-between gap-3 rounded-[10px] border px-3.5 py-2.5"
          style={{ borderColor: "var(--chrome-line)", background: "var(--surface-soft)" }}
        >
          <span
            className="min-w-0 truncate text-[13px]"
            style={{ color: thread.requestTitle ? "var(--ink)" : "var(--text-tertiary)" }}
          >
            {thread.requestTitle ?? "No Request"}
          </span>
          <Button unsized href={linkHref} variant="secondary" className="shrink-0 px-3 py-[5px] text-[12.5px]">
            {thread.requestTitle ? "Change" : "Add to Request"}
          </Button>
        </div>

        <Rule />

        {/* Remove is a client action — not a Save-form submit — so the page
            does not reload and Save does not spin. */}
        <GroupPeopleSettings
          threadId={thread.id}
          people={people}
          recipients={recipients}
          alreadyKinds={people.map((person) => person.kind)}
        />

        {/*
         * The footer stays put while the rest scrolls.
         *
         * The panel is taller than a laptop window with five people on it, and
         * Save was below the fold — a dialog whose only way to finish has to
         * be scrolled to is one people close instead. Pulled out to the
         * dialog's own edges so the line above it runs the full width.
         */}
        <div
          className="sticky bottom-0 -mx-[30px] -mb-7 mt-5 flex flex-wrap items-center justify-between gap-3 border-t px-[30px] pb-7 pt-4"
          style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
        >
          <div className="flex items-center gap-3">
            <Button unsized href={archiveHref} variant="secondary" className="px-3.5 py-[7px] text-[12.5px]">
              {thread.archived ? "Bring it back" : "Archive"}
            </Button>

            {group ? (
              thread.canDelete ? (
                <Button
                  unsized
                  href={deleteHref}
                  variant="secondary"
                  className="px-3.5 py-[7px] text-[12.5px]"
                  style={{ color: "var(--danger-text)" }}
                >
                  Delete group
                </Button>
              ) : (
                <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  Only its creator can delete this group.
                </span>
              )
            ) : null}
          </div>

          <div className="flex items-center gap-2.5">
            <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
              Cancel
            </Button>
            <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
              Save
            </Submit>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** The hairline between one part of a settings panel and the next. */
function Rule() {
  return <div className="my-4 h-px" style={{ background: "var(--chrome-line)" }} />;
}

/** What the part under it is for. */
function SectionLabel({
  children,
  flush,
}: {
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <span
      className={`block text-[11px] font-semibold uppercase tracking-[.05em] ${
        flush ? "" : "mb-2"
      }`}
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </span>
  );
}

/** Where every picker groups people, and what it calls each group. */
const GROUPS: { kind: Recipient["kind"]; label: string }[] = [
  { kind: "teammate", label: "Your team" },
  { kind: "contact", label: "Client members and contacts" },
  { kind: "provider", label: "Providers" },
];

/**
 * What somebody is to their client workspace, in the words the rest of Whitby
 * uses. A group is built out of these, and a picker calling all five of them
 * "contact" makes somebody guess which Ahmed is the dependent.
 */
const ROLE_WORDS: Record<string, string> = {
  primary_member: "Member",
  additional_member: "Additional member",
  authorized_user: "Authorized user",
  dependent: "Dependent",
  primary_contact: "Primary contact",
  billing_contact: "Billing contact",
  decision_maker: "Decision-maker",
  authorized_representative: "Authorized representative",
};

/** "Rohail Khan · Dependent", where there is a role worth naming. */
function saysWho(person: Recipient) {
  const role =
    person.role && person.role !== "provider" ? ROLE_WORDS[person.role] : null;
  return [person.detail, role].filter(Boolean).join(" · ") || null;
}

/**
 * The + above the conversation list.
 *
 * Everyone in the workspace, grouped by how they are reached, and one click
 * starts a conversation with them. Picking someone you already have a direct
 * thread with reopens that thread rather than starting a second one.
 *
 * Each row is its own submit button carrying its own value, so there is nothing
 * to select and then confirm — the list is the control.
 */
export function NewDirectDialog({
  recipients,
  requests,
  scopeName,
  closeHref,
  error,
}: {
  recipients: Recipient[];
  /** What this conversation would be about, if it is about one thing. */
  requests: Option[];
  /** The client workspace that is open, whose people these are. */
  scopeName?: string | null;
  closeHref: string;
  error?: string;
}) {
  /* Providers are on this list too — same directory the group picker uses. */
  const people = recipients;

  return (
    <Modal title="New Message" closeHref={closeHref} width={400} dense>
      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {scopeName ? (
        <p className="mb-3 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          People in {scopeName} and your own team.
        </p>
      ) : null}

      {people.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          No one to message yet. Contacts, providers, and teammates appear here.
        </p>
      ) : (
        <form>
          {/*
           * What it is about, chosen before who it is with.
           *
           * A conversation carries the Request it belongs to, so the same
           * person about two different pieces of work is two conversations —
           * picking the Request here is what decides which one opens, rather
           * than dropping this talk into the last one you had with them.
           */}
          {requests.length > 0 ? (
            <div className="mb-3">
              <span
                className="mb-1.5 block text-[12px] font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                About a Request (optional)
              </span>
              <select name="request_id" defaultValue="" className={SMALL_CONTROL}>
                <option value="">Nothing in particular</option>
                {requests.map((request) => (
                  <option key={request.id} value={request.id}>
                    {request.title}
                  </option>
                ))}
              </select>
              <span
                className="mt-1.5 block text-[11.5px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Each Request keeps its own thread inside your conversation
                with this person.
              </span>
            </div>
          ) : null}

          <div className="max-h-[300px] overflow-auto">
          {GROUPS.map((group) => {
            const section = people.filter((person) => person.kind === group.kind);
            if (section.length === 0) return null;

            return (
              <div key={group.kind} className="mb-3 last:mb-0">
                <span
                  className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-[.05em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {group.label}
                </span>

                {section.map((person) => (
                  <SubmitPlain
                    key={`${person.kind}-${person.id}`}
                    formAction={startDirect.bind(null, `${person.kind}:${person.id}`)}
                    className="flex w-full items-center gap-2.5 rounded-control px-2 py-2 text-left text-[13.5px] hover:bg-[var(--surface-soft)]"
                  >
                    <PickerFace name={person.name} photo={person.photo} size={28} />
                    <span className="min-w-0 flex-1 truncate">{person.name}</span>
                    {saysWho(person) ? (
                      <span
                        className="shrink-0 text-[11.5px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {saysWho(person)}
                      </span>
                    ) : null}
                  </SubmitPlain>
                ))}
              </div>
            );
          })}
          </div>
        </form>
      )}

      <p className="mt-4 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
        {people.some((person) => person.kind === "contact")
          ? "Teammates see this in Whitby, and a client contact sees it in their portal once they have access."
          : people.some((person) => person.kind === "provider")
            ? "Teammates see this in Whitby. A provider conversation is kept on the firm side."
            : "Teammates see this in Whitby."}
      </p>
    </Modal>
  );
}

/**
 * Somebody's face in a picker: their photograph where they have added one,
 * their initials where they have not. The same mark the rail and the
 * conversation draw, so the person you pick here is the one you recognise
 * there.
 */
function PickerFace({
  name,
  photo,
  size = 30,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold"
      style={{
        background: "var(--avatar-tan-bg)",
        color: "var(--avatar-tan-fg)",
        height: size,
        width: size,
        fontSize: Math.round(size * 0.36),
      }}
      aria-hidden
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
