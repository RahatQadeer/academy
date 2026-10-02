import { Input } from "@/base/components/Input";
import { startConversation } from "@/client-portal/lib/actions/messages";
import { Modal } from "@/client-portal/components/Modal";
import {
  FieldGroup,
  CancelLink, FormActions,
  Select,
  Textarea,
} from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import type { PortalPerson, PortalRequest } from "@/client-portal/types";

/**
 * A conversation the client starts.
 *
 * `subject` is NOT NULL on `whitbyos_message_threads`, the first message is what
 * makes it a conversation rather than an empty row in somebody's inbox, and the
 * Request is the optional one.
 *
 * Naming a Request is offered rather than required, which is the whole point of
 * the screen. A client with a question that belongs to no open Request could
 * previously only ask it by raising a Request they did not want.
 *
 * Open requests only. A conversation is started to move something forward, and
 * offering to hang one off work that closed last quarter invites a client to
 * file a live question somewhere nobody is looking.
 *
 * WHO IT IS WITH
 * The screen used to leave this unanswered, and it was the first thing anyone
 * asked of it. The team is the default and the first option, because it is what
 * the portal is for and what every thread before this one did. The other people
 * on the account follow, when there are any — an account with nobody else on it
 * shows no picker at all rather than a control with one entry.
 *
 * The line about the team seeing everything is not a disclaimer to be trimmed.
 * The professional's inbox lists every thread in the workspace, so a
 * conversation naming a spouse is read by the advisers too; a client who
 * assumed otherwise would have been misled by this screen, not by anyone's
 * intent.
 */
export function NewConversationModal({
  closeHref,
  requests,
  people,
}: {
  closeHref: string;
  requests: PortalRequest[];
  /** Others on the account who can be written to. Empty on most accounts. */
  people: PortalPerson[];
}) {
  const open = requests.filter((request) => request.status !== "completed");

  return (
    <Modal
      title="Start a conversation"
      description="Your team sees this straight away and will reply here."
      closeHref={closeHref}
      width={560}
    >
      <form action={startConversation}>
        <FieldGroup>
          {people.length > 0 ? (
            <Select
              label="With"
              name="recipientContactId"
              placeholder="Your team"
              options={people.map((person) => ({
                value: person.contactId ?? "",
                label: [person.name, person.relationship]
                  .filter(Boolean)
                  .join(" · "),
              }))}
            />
          ) : null}

          <Input
            label="Subject"
            name="subject"
            required
            maxLength={140}
            placeholder="What is this about?"
          />

          {open.length > 0 ? (
            <Select
              label="About a request (optional)"
              name="requestId"
              placeholder="Not about a particular request"
              options={open.map((request) => ({
                value: request.id,
                label: request.title,
              }))}
            />
          ) : null}

          <Textarea
            label="Message"
            name="body"
            rows={5}
            required
            maxLength={4000}
            placeholder="Write your message"
          />
        </FieldGroup>

        {people.length > 0 ? (
          <p
            className="mt-3 text-[12.5px] leading-snug"
            style={{ color: "var(--text-tertiary)" }}
          >
            Your team can see every conversation on this account, including ones
            you start with someone else on it.
          </p>
        ) : null}

        <FormActions>
          <CancelLink href={closeHref} />
          <SubmitButton pendingLabel="Starting…">Start conversation</SubmitButton>
        </FormActions>
      </form>
    </Modal>
  );
}
