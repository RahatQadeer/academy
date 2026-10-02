import { SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { chooseStartingPoint } from "@/whitbyos/playbooks/actions";

const LIST = "/whitbyos/playbooks";

/** 1 Starting point · 2 Details · 3 Build Work Streams · 4 Save. */
export const PLAYBOOK_STEPS = [
  "Starting point",
  "Details",
  "Build Work Streams",
  "Save",
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 6.0a — Step 1, how to start this Playbook.
 *
 * Three ways in, and the reference gives each its own path through the same
 * four steps. Blank goes straight to Details; the other two stop at a picker
 * first, which is why they submit rather than link — the choice travels in the
 * form, and the route is decided in one place rather than in three hrefs.
 */
export default async function NewPlaybookPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const error = one(searchParams?.error);

  return (
    <WizardChrome steps={PLAYBOOK_STEPS} current={0} backHref={LIST} backLabel="Cancel">
      <div className="flex flex-1 items-center justify-center px-10 py-12">
        <div className="flex w-full max-w-[820px] flex-col gap-6">
          <div className="text-center">
            <h1 className="mb-1.5 text-[24px] font-bold">
              How do you want to start this Playbook?
            </h1>
          </div>

          {error ? <Callout tone="danger">{error}</Callout> : null}

          {/* One form per card, each with its own hidden input, rather than one
              form and three named submit buttons. A name on a submitter is the
              trap WP.2c fell into, and three forms cost nothing. */}
          <div className="flex gap-4">
            <Card
              value="blank"
              glyph="✎"
              title="Blank Playbook"
              body="Add Work Streams and tasks yourself, with full control over structure."
            />
            <Card
              value="duplicate"
              glyph="▤"
              title="Duplicate an Existing Playbook"
              body="Start from one of your current Playbooks and adjust it."
            />
            <Card
              value="workplan"
              glyph="❖"
              title="Save From a Work Plan"
              body="Turn a completed Work Plan's structure into a reusable Playbook."
            />
          </div>
        </div>
      </div>
    </WizardChrome>
  );
}

function Card({
  value,
  glyph,
  title,
  body,
}: {
  value: string;
  glyph: string;
  title: string;
  body: string;
}) {
  return (
    <form action={chooseStartingPoint} className="flex flex-1">
      <input type="hidden" name="from" value={value} />
      <SubmitPlain
       
        className="flex flex-1 cursor-pointer flex-col gap-2.5 rounded-card border border-line bg-surface p-[22px] text-left transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ outlineColor: "var(--accent)" }}
      >
        <span
          className="flex h-[38px] w-[38px] items-center justify-center rounded-swatch text-[17px]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          {glyph}
        </span>
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-[12.5px] leading-[1.55]" style={{ color: "var(--text-soft)" }}>
          {body}
        </span>
      </SubmitPlain>
    </form>
  );
}
