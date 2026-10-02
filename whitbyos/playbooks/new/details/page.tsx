import { Callout } from "@/base/components/Callout";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { CONTROL_UNSIZED, Field } from "@/whitbyos/components/Field";
import { savePlaybookDetails } from "@/whitbyos/playbooks/actions";
import { getPlaybook } from "@/whitbyos/lib/playbooks";
import { getWorkPlan } from "@/whitbyos/lib/work-plans";
import { PLAYBOOK_CATEGORIES, SHARED_LEVELS } from "@/whitbyos/lib/playbook-vocab";
import { PLAYBOOK_STEPS } from "@/whitbyos/playbooks/new/page";

const LIST = "/whitbyos/playbooks";
const NEW = `${LIST}/new`;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 6.0b — Step 2, the Playbook's details.
 *
 * The same three fields on all three paths; what changes is what they arrive
 * holding. Duplicating pre-fills from the source and says so above the form,
 * saving from a Work Plan does the same and promises in the description that
 * client-specific detail is left behind.
 */
export default async function PlaybookDetailsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const from = one(searchParams?.from) ?? "blank";
  const sourceId = one(searchParams?.source) ?? "";
  const draftId = one(searchParams?.draft) ?? "";
  const error = one(searchParams?.error);

  const [playbook, plan, draft] = await Promise.all([
    from === "duplicate" && sourceId ? getPlaybook(sourceId) : Promise.resolve(null),
    from === "workplan" && sourceId ? getWorkPlan(sourceId) : Promise.resolve(null),
    draftId ? getPlaybook(draftId) : Promise.resolve(null),
  ]);

  const source = playbook ?? plan;
  const sourceName = playbook?.name ?? plan?.name ?? null;

  const defaults = draft
    ? {
        name: draft.name,
        category: draft.category ?? PLAYBOOK_CATEGORIES[0]!,
        description: draft.description ?? "",
        shared: draft.sharedLevel ?? "private",
      }
    : {
        name: playbook ? `Copy of ${playbook.name}` : plan ? `${plan.name}, Playbook` : "",
        category: playbook?.category ?? PLAYBOOK_CATEGORIES[0]!,
        description: playbook
          ? (playbook.description ??
            `Inherited from ${playbook.name}, editable here.`)
          : plan
            ? `Captures the current Work Streams from the ${plan.name} Work Plan as a reusable template, client-specific details are stripped out.`
            : "",
        shared: "private",
      };

  const backHref =
    from === "blank" ? NEW : `${NEW}/source?from=${from}`;

  return (
    <WizardChrome steps={PLAYBOOK_STEPS} current={1} backHref={backHref} backLabel="Back">
      <div className="flex flex-1 justify-center px-10 py-12">
        {/* 6.0b is a card on the canvas rather than a bare column — 560 wide,
            36 of padding, 18 between its parts. */}
        <div
          className="flex h-fit w-full max-w-[560px] flex-col gap-[18px] rounded-card border border-line bg-surface p-9"
        >
          <h1 className="text-[21px] font-bold">Playbook details</h1>

          {error ? <Callout tone="danger">{error}</Callout> : null}

          {source && sourceName ? (
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {from === "duplicate" ? "Duplicating: " : "Saving from Work Plan: "}
              <strong style={{ color: "var(--ink)" }}>{sourceName}</strong>
            </p>
          ) : null}

          <form action={savePlaybookDetails} className="flex flex-col gap-[18px]">
            <input type="hidden" name="from" value={from} />
            {sourceId ? <input type="hidden" name="source" value={sourceId} /> : null}
            {draftId ? <input type="hidden" name="draft_id" value={draftId} /> : null}

            <Field label="Name" htmlFor="name">
              <input
                id="name"
                name="name"
                required
                defaultValue={defaults.name}
                placeholder="e.g. International Relocation, Family"
                className={`${CONTROL_UNSIZED} text-[13.5px]`}
              />
            </Field>

            <Field label="Category" htmlFor="category">
              <select
                id="category"
                name="category"
                defaultValue={defaults.category}
                className={`${CONTROL_UNSIZED} text-[13.5px]`}
              >
                {PLAYBOOK_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Description" htmlFor="description">
              <textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={defaults.description}
                placeholder="What kind of engagement is this Playbook for?"
                className={`${CONTROL_UNSIZED} resize-y text-[13.5px] leading-[1.55]`}
              />
            </Field>

            <Field label="Visible To" htmlFor="shared_level">
              <select
                id="shared_level"
                name="shared_level"
                defaultValue={defaults.shared}
                className={`${CONTROL_UNSIZED} text-[13.5px]`}
              >
                {SHARED_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.value === "private"
                      ? "Only Me"
                      : level.value === "team"
                        ? "Shared with Team"
                        : "Entire Organization"}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end">
              <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
                Continue →
              </Submit>
            </div>
          </form>
        </div>
      </div>
    </WizardChrome>
  );
}
