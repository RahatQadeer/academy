import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { chooseSource } from "@/whitbyos/playbooks/actions";
import { listPlaybooks } from "@/whitbyos/lib/playbooks";
import { listWorkPlans } from "@/whitbyos/lib/work-plans";
import { sharedLabel, sharedTone } from "@/whitbyos/lib/playbook-vocab";
import { PLAYBOOK_STEPS } from "@/whitbyos/playbooks/new/page";

const LIST = "/whitbyos/playbooks";
const NEW = `${LIST}/new`;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const PLAN_STATUS: Record<string, string> = {
  draft: "Draft",
  active: "Running",
  complete: "Completed",
};

/**
 * 6.0a-i and 6.0a-ii — pick the Playbook to duplicate, or the Work Plan to
 * save from.
 *
 * One screen for both. They differ in what they list and in one sentence of
 * heading; everything else — the step rail, the radio rows, Continue — is the
 * same, and two files would be the same file twice.
 */
export default async function PlaybookSourcePage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const from = one(searchParams?.from) === "workplan" ? "workplan" : "duplicate";
  const error = one(searchParams?.error);

  const [playbooks, plans] = await Promise.all([
    from === "duplicate" ? listPlaybooks() : Promise.resolve(null),
    from === "workplan" ? listWorkPlans() : Promise.resolve(null),
  ]);

  const rows =
    from === "duplicate"
      ? (playbooks?.ok ? playbooks.rows : []).map((row) => ({
          id: row.id,
          title: row.name,
          detail: `${row.category ?? "Uncategorised"} · ${row.streamCount} Work Stream${
            row.streamCount === 1 ? "" : "s"
          } · v${row.version}`,
          tone: sharedTone(row.sharedLevel),
          badge: sharedLabel(row.sharedLevel),
        }))
      : (plans?.ok ? plans.rows : []).map((row) => ({
          id: row.id,
          title: row.name,
          detail: `${row.client_name} · ${row.streamCount} Work Stream${
            row.streamCount === 1 ? "" : "s"
          } · ${PLAN_STATUS[row.status] ?? row.status}${
            row.taskTotal > 0 ? ` · ${row.progress}% complete` : ""
          }`,
          tone: (row.status === "complete" ? "success" : "neutral") as "success" | "neutral",
          badge: PLAN_STATUS[row.status] ?? row.status,
        }));

  return (
    <WizardChrome steps={PLAYBOOK_STEPS} current={0} backHref={NEW} backLabel="Back">
      <div className="flex flex-1 justify-center px-10 py-12">
        <div className="flex h-fit w-full max-w-[620px] flex-col gap-4">
          <h1 className="text-[21px] font-bold">
            {from === "duplicate"
              ? "Select a Playbook to duplicate"
              : "Select a Work Plan to save from"}
          </h1>

          {error ? <Callout tone="danger">{error}</Callout> : null}

          {rows.length === 0 ? (
            <Callout tone="warning">
              {from === "duplicate"
                ? "There are no Playbooks to duplicate yet, start a blank one instead."
                : "There are no Work Plans in this workspace yet, so there is nothing to save from."}
            </Callout>
          ) : (
            <form action={chooseSource} className="flex flex-col gap-4">
              <input type="hidden" name="from" value={from} />

              {/* 6.0a-i draws each choice as its own card with 10px between,
                  not as rows sharing one border, a list of things to pick
                  rather than a table to read down. */}
              <div className="flex flex-col gap-2.5">
                {rows.map((row, index) => (
                  <label
                    key={row.id}
                    className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-line px-4 py-3.5 transition-colors hover:bg-surface-soft"
                  >
                    <input
                      type="radio"
                      name="source_id"
                      value={row.id}
                      defaultChecked={index === 0}
                      className="shrink-0 accent-[var(--accent)]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[14px] font-medium">{row.title}</span>
                      <span
                        className="mt-0.5 text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {row.detail}
                      </span>
                    </span>
                    <Pill tone={row.tone}>{row.badge}</Pill>
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <Submit unsized variant="primary" className="px-4 py-[9px] text-[13.5px]">
                  Continue →
                </Submit>
              </div>
            </form>
          )}
        </div>
      </div>
    </WizardChrome>
  );
}
