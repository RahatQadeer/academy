import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { archiveWorkPlan } from "@/whitbyos/work-plans/actions";
import type { PlanLinks } from "@/whitbyos/lib/work-plans";

/**
 * WP.2c — archiving a Work Plan, or removing it for good.
 *
 * The reference draws both choices as white boxes with a hairline border. In
 * the mock that reads as a button because nothing around it is a panel; in the
 * app it does not, and Sabahat could not tell the safe choice was pressable.
 * So Archive is the accent button it behaves like — the recommended way out —
 * and Delete keeps its red. A deliberate departure, not a slip.
 *
 * It has no title bar and no ✕, which is deliberate in the reference: the way
 * out is the Cancel underneath, and there is no control at the corner that a
 * hurried hand can hit on the way to somewhere else. So it is drawn here
 * rather than through Modal, which always gives a dialog a close mark.
 *
 * Both choices are buttons rather than a checkbox and a confirm, because they
 * are two different outcomes rather than one outcome with a setting — and the
 * heavier one is written in the colour of what it does.
 */
export function DeletePlanDialog({
  planId,
  planName,
  links,
  closeHref,
}: {
  planId: string;
  planName: string;
  links: PlanLinks;
  closeHref: string;
}) {
  const linked = [
    `${links.streams} Work Stream${links.streams === 1 ? "" : "s"}`,
    `${links.tasks} Task${links.tasks === 1 ? "" : "s"}`,
    links.hasRequest ? "Request" : null,
    links.documents > 0
      ? `${links.documents} Document${links.documents === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Archive ${planName}`}
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      style={{ background: "rgba(55,53,47,.4)" }}
    >
      <div
        className="flex w-full flex-col gap-3.5 rounded-card bg-surface p-7"
        style={{ maxWidth: 460, boxShadow: "0 12px 40px rgba(15,15,15,.18)" }}
      >
        <h2 className="text-[18px] font-bold">Archive {planName}?</h2>

        <p className="text-[13px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
          {linked.length > 0
            ? "This Work Plan has linked records."
            : "This Work Plan has nothing linked to it."}
        </p>

        {linked.length > 0 ? (
          <div
            className="rounded-[8px] px-3.5 py-3 text-[12.5px] leading-[1.8]"
            style={{ background: "var(--surface-soft)", color: "var(--text-secondary)" }}
          >
            Linked:{" "}
            {linked.map((item, index) => (
              <span key={item}>
                {/* "the linked" sits outside the bold, the way the reference
                    draws it, what is emphasised is the record, not the words
                    introducing it. */}
                {item === "Request" ? "the linked " : null}
                <strong style={{ color: "var(--ink)" }}>{item}</strong>
                {index < linked.length - 2 ? ", " : index === linked.length - 2 ? ", and " : ""}
              </span>
            ))}
            .
          </div>
        ) : null}

        {/* `scope` travels as a hidden input rather than on the button. React
            encodes a Server Action into the submitter's own `name`, so a
            `name="scope"` there is overridden and never arrives. */}
        <div className="flex flex-col gap-2">
          <form action={archiveWorkPlan} className="contents">
            <input type="hidden" name="plan_id" value={planId} />
            <input type="hidden" name="scope" value="archive" />
            <SubmitPlain
             
              // bg-accent as a class, not an inline style: an inline background would
              // outrank the hover rule and the button would never respond.
              className="cursor-pointer rounded-control bg-accent px-3.5 py-2.5 text-left text-[13.5px] font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
              style={{ outlineColor: "var(--accent)" }}
            >
              Archive this Work Plan
              <br />
              <span className="text-[11.5px] font-normal" style={{ color: "rgba(255,255,255,.8)" }}>
                The Request and Documents stay linked. Unarchive anytime from
                Settings → Archive
              </span>
            </SubmitPlain>
          </form>

        </div>

        {/* Delete used to sit here, one press from the plan it would destroy.
            It is on the Archive screen now, see the shared dialog for why. */}
        <p className="text-[12px] leading-[1.6]" style={{ color: "var(--text-tertiary)" }}>
          To delete it for good, archive it first and use Settings → Archive.
          Deleting also removes all Work Streams, Tasks and their checklists, and
          for a plan older than 15 minutes the client is asked first.
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
