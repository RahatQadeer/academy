import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import type { VisibilityPerson } from "@/whitbyos/lib/plan-visibility";

/**
 * WP.17v and WP.17u — who can see this Work Plan, or this Work Stream.
 *
 * One component for both, because the export draws one dialog twice: same
 * 440px card, same list of names with a checkbox against each, same two
 * buttons. Only the heading, the sentence under it and the footnote change,
 * so those are props rather than a second file.
 *
 * No close mark, as the reference has none — Cancel is the way out, which is
 * the condition `Modal`'s `noClose` asks for.
 *
 * The owner's checkbox is ticked and disabled. A disabled box posts nothing,
 * which is why the action writes the owner in regardless of the form.
 *
 * A server component: every piece of state here is already in the URL or the
 * row, and the ticks are read by the action from the form itself.
 *
 * Below the team sits the one control that reaches outside the workspace: the
 * client-portal switch (client-portal/013). It travels with a `client_present`
 * marker, because an unticked box and a switch that was never drawn post the
 * same nothing, and only the first is an answer.
 */
export function VisibilityDialog({
  title,
  description,
  footnote,
  people,
  action,
  hidden,
  closeHref,
  error,
  client,
}: {
  title: string;
  description: string;
  /** WP.17v points at the per-stream control; WP.17u has nothing below it. */
  footnote?: string;
  people: VisibilityPerson[];
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  closeHref: string;
  error?: string;
  /** Absent where the portal's columns are not there yet. */
  client?: { label: string; checked: boolean; note: string; disabled?: boolean } | null;
}) {
  return (
    <Modal
      title={title}
      closeHref={closeHref}
      width={440}
      pad="p-[26px]"
      titleSize={17}
      headerGap={16}
      noClose
      // The reference draws this scrim a shade lighter than the dialogs the
      // default was taken from.
      scrim="rgba(55,53,47,.4)"
    >
      <form action={action} className="flex flex-col gap-4">
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}

        {error ? <Callout tone="danger">{error}</Callout> : null}

        {/* .55 sits between --text-secondary (.65) and --text-tertiary (.5),
            so it is written out rather than rounded to a token. */}
        <p
          className="text-[12.5px] leading-[1.5]"
          style={{ margin: 0, color: "rgba(55,53,47,.55)" }}
        >
          {description}
        </p>

        <div className="flex flex-col gap-2">
          {people.length === 0 ? (
            <p className="text-[13px]" style={{ color: "rgba(55,53,47,.55)" }}>
              Nobody else has joined this workspace yet.
            </p>
          ) : (
            people.map((person) => (
              <label
                key={person.userId}
                className="flex items-center gap-2 text-[13px]"
                style={{ color: "var(--ink)" }}
              >
                {/* The roster travels with the form so the action can tell a
                    list that names everyone from one that leaves somebody
                    out — the first stores nothing and stays open. */}
                <input type="hidden" name="candidate" value={person.userId} />
                <input
                  type="checkbox"
                  name="viewer"
                  value={person.userId}
                  defaultChecked={person.checked}
                  disabled={person.isOwner}
                />
                {person.name}
                {person.roleLabel ? ` (${person.roleLabel})` : ""}
              </label>
            ))
          )}
        </div>

        {footnote ? (
          <p
            className="text-[11.5px]"
            style={{ margin: 0, color: "rgba(55,53,47,.45)" }}
          >
            {footnote}
          </p>
        ) : null}

        {client ? (
          <div className="flex flex-col gap-1.5 border-t border-line pt-4">
            {/* A disabled switch is shown so the option can be found, and posts
                no marker, so saving the dialog cannot be read as an answer. */}
            {client.disabled ? null : <input type="hidden" name="client_present" value="1" />}
            <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
              Client portal
            </span>
            <label
              className="flex items-center gap-2 text-[13px]"
              style={{ color: client.disabled ? "rgba(55,53,47,.45)" : "var(--ink)" }}
            >
              <input
                type="checkbox"
                name="client_share"
                value="1"
                defaultChecked={client.checked}
                disabled={client.disabled}
              />
              {client.label}
            </label>
            <p
              className="text-[11.5px] leading-[1.45]"
              style={{ margin: 0, color: "rgba(55,53,47,.45)" }}
            >
              {client.note}
            </p>
          </div>
        ) : null}

        <div className="flex justify-end gap-2.5">
          <Button
            unsized
            href={closeHref}
            variant="secondary"
            className="px-4 py-[9px] text-[13.5px]"
          >
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
            Save
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
