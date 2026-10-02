import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { archivePlaybook } from "@/whitbyos/playbooks/actions";

/**
 * 6.3 — archiving a Playbook, or removing it for good.
 *
 * Drawn to match WP.2c rather than to the reference's own two white boxes: the
 * two dialogs do the same thing and now say the same words, so they should not
 * look like different features. Archive is the accent button it behaves like,
 * Delete keeps its red, and there is no ✕ at the corner — the way out is the
 * Cancel underneath, where a hurried hand is not already heading.
 */
export function ArchivePlaybookDialog({
  playbookId,
  playbookName,
  links,
  closeHref,
}: {
  playbookId: string;
  playbookName: string;
  links: { plans: number; streams: number };
  closeHref: string;
}) {
  const used = links.plans > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Archive ${playbookName}`}
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "rgba(55,53,47,.4)" }}
    >
      <div
        className="flex w-full flex-col gap-3.5 rounded-card bg-surface p-7"
        style={{ maxWidth: 460, boxShadow: "0 12px 40px rgba(15,15,15,.18)" }}
      >
        <h2 className="text-[18px] font-bold">Archive &ldquo;{playbookName}&rdquo;?</h2>

        <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
          {used
            ? "This Playbook has been used on other Work Plans. Choose what to remove:"
            : "This Playbook has not been used on any Work Plan yet."}
        </p>

        <div
          className="rounded-[8px] px-3.5 py-3 text-[12.5px] leading-[1.8]"
          style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
        >
          Linked to this Playbook:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {links.plans} Work Plan{links.plans === 1 ? "" : "s"} created from it
          </strong>{" "}
          and{" "}
          <strong style={{ color: "var(--ink)" }}>
            {links.streams} Work Stream{links.streams === 1 ? "" : "s"}
          </strong>
          .
        </div>

        {/* `scope` travels as a hidden input, not on the button. React encodes
            a Server Action into the submitter's own `name`, so a name there is
            overridden and never arrives. */}
        <div className="flex flex-col gap-2">
          <form action={archivePlaybook} className="contents">
            <input type="hidden" name="playbook_id" value={playbookId} />
            <input type="hidden" name="scope" value="archive" />
            <SubmitPlain
             
              className="cursor-pointer rounded-control bg-accent px-3.5 py-2.5 text-left text-[13.5px] font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
              style={{ outlineColor: "var(--accent)" }}
            >
              Archive this Playbook
              <br />
              <span className="text-[11.5px] font-normal" style={{ color: "rgba(255,255,255,.8)" }}>
                Hides it from the library. Work Plans already created from it are
                unaffected. Unarchive anytime from Settings → Archive
              </span>
            </SubmitPlain>
          </form>

        </div>

        {/* Delete has left every screen a record lives on. Settings → Archive
            is where it happens, so filing away and destroying are two
            decisions made in two places. */}
        <p className="text-[12px] leading-[1.6]" style={{ color: "var(--text-tertiary)" }}>
          To delete it for good, archive it first and use Settings → Archive.
          Deleting removes the Playbook and all its saved versions. Work Plans
          already created from it are unaffected either way.
        </p>

        <div className="mt-1 flex justify-end">
          <Link
            href={closeHref}
            className="text-[13px] no-underline"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
