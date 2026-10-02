import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { StatusPill } from "@/whitbyos/components/StatusPill";
import { ShowMore } from "@/whitbyos/components/ShowMore";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import {
  HealthPill,
  ProgressMeter,
  healthLabel,
  urgencyLabel,
} from "@/whitbyos/work-plans/components/PlanMeters";
import { DeletePlanDialog } from "@/whitbyos/work-plans/components/DeletePlanDialog";
import { getPlanLinks, listWorkPlans } from "@/whitbyos/lib/work-plans";
import { matchesSearch } from "@/whitbyos/lib/search";
import { retryWorkPlans } from "@/whitbyos/work-plans/actions";
import { shortDate } from "@/whitbyos/lib/format";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";

const LIST = "/whitbyos/work-plans";

const COLUMNS: Column[] = [
  { label: "Work Plan", width: "2.2fr" },
  { label: "Client", width: "1.4fr" },
  { label: "Status", width: "1fr" },
  { label: "Urgency", width: "1fr" },
  { label: "Health", width: "1fr" },
  { label: "Progress", width: "1.2fr" },
  { label: "Due", width: "1fr" },
  // WP.2 keeps a fixed lane on the end for the row's own archive.
  { label: "", width: "72px" },
];

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** WP.1 / WP.2 / WP.2b, with WP.2c over them. */
export default async function WorkPlansPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const deletingId = one(searchParams?.delete);
  const q = (one(searchParams?.q) ?? "").trim();
  const status = one(searchParams?.status) ?? "";
  const urgency = one(searchParams?.urgency) ?? "";
  const health = one(searchParams?.health) ?? "";
  const showClients = await usesClientWorkspaces();

  const [result, links] = await Promise.all([
    listWorkPlans(),
    deletingId ? getPlanLinks(deletingId) : Promise.resolve(null),
  ]);

  const deleting =
    deletingId && result.ok ? result.rows.find((row) => row.id === deletingId) : null;

  const rows = result.ok
    ? result.rows
        .filter((plan) =>
          matchesSearch(q, [
            plan.name,
            plan.client_name,
            plan.status,
            urgencyLabel(plan.urgency),
            healthLabel(plan.health),
          ]),
        )
        .filter((plan) => !status || plan.status.toLowerCase() === status.toLowerCase())
        .filter((plan) => !urgency || plan.urgency === urgency)
        .filter((plan) => !health || plan.health === health)
    : [];

  // WP.2b is the whole screen, not a panel inside it: the reference draws the
  // failure centred in the frame with no heading and no Create button above
  // it. There is nothing to create on a list nobody could read.
  if (!result.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We could not load your Work Plans. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button
                href="mailto:support@privateattache.com?subject=Work%20Plans%20failed%20to%20load"
                variant="secondary"
                unsized
                className="px-4 py-[9px] text-[14px]"
              >
                Contact support
              </Button>
              {/* A real retry: the action re-reads the list on the server and
                  sends you back here. A link to this same URL would be served
                  from the router's cache and change nothing. */}
              <form action={retryWorkPlans}>
                <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[14px]">
                  Try again
                </Submit>
              </form>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      {/* WP.1 gives the heading 28px of air because nothing follows it but the
          empty state; WP.2 gives it 20 because a table does. */}
      <PageHeader
        title="My Active Work Plans"
        subtitle="Plans turn a Request into Work Streams, tasks and checklists. Open one to work it, or archive what you are done with."
        gap={result.rows.length === 0 ? 28 : 20}
        action={
          result.rows.length === 0 ? undefined : (
            <Button
              href={`${LIST}/new`}
              variant="primary"
              unsized
              className="px-4 py-[9px] text-[14px]"
            >
              + Create Work Plan
            </Button>
          )
        }
      />

      {result.rows.length === 0 ? (
        <StateMessage
          glyph="❖"
          title="No Work Plans yet"
          description="Work Plans organize a Request into Work Streams, tasks and checklists. Build one with Whitby, from a Playbook, by importing a document, or from scratch."
          action={
            <Button
              href={`${LIST}/new`}
              variant="primary"
              unsized
              className="px-5 py-2.5 text-[13.5px]"
            >
              + Create Work Plan
            </Button>
          }
        />
      ) : (
        <>
          <FilterBar
            action={LIST}
            searchPlaceholder="Search work plans…"
            searchValue={q}
            selects={[
              {
                name: "status",
                anyLabel: "All statuses",
                value: status,
                options: [
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "completed", label: "Completed" },
                  { value: "paused", label: "Paused" },
                ],
              },
              {
                name: "urgency",
                anyLabel: "All urgency",
                value: urgency,
                options: [
                  { value: "critical", label: "Critical" },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ],
              },
              {
                name: "health",
                anyLabel: "All health",
                value: health,
                options: [
                  { value: "on_track", label: "On Track" },
                  { value: "needs_attention", label: "Needs Attention" },
                  { value: "at_risk", label: "At Risk" },
                ],
              },
            ]}
            trailing={
              <span
                className="ml-auto text-[12px] font-medium tabular-nums"
                style={{ color: "var(--text-tertiary)" }}
              >
                {rows.length} {rows.length === 1 ? "plan" : "plans"}
              </span>
            }
          />
          {rows.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {q || status || urgency || health
                ? "Nothing matches these filters."
                : "Nothing to show."}
            </p>
          ) : (
            <DataTable
              columns={
                showClients
                  ? COLUMNS
                  : COLUMNS.filter((column) => column.label !== "Client")
              }
              rowPadding={14}
            >
              <ShowMore step={8}>
                {rows.map((plan) => (
                  <DataTableRow
                    key={plan.id}
                    href={`${LIST}/${plan.id}`}
                    trailing={
                      // v2 writes the words rather than drawing a bin, and greys
                      // them right down. Plain text at the disabled token read as
                      // disabled rather than quiet, so this keeps the words and
                      // gives them an outline: still the quietest thing in the row,
                      // but plainly something you press, and it turns the colour of
                      // what it does under the cursor.
                      <Link
                        href={`${LIST}?delete=${plan.id}`}
                        title="Archive work plan"
                        aria-label={`Archive ${plan.name}`}
                        className="whitespace-nowrap rounded-[5px] border border-line px-2 py-[3px] text-[11.5px] no-underline transition-colors hover:border-[var(--danger-action-border)] hover:bg-[var(--danger-action-bg)] hover:text-[var(--danger-action-fg)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        Archive
                      </Link>
                    }
                  >
                    <DataTableCell emphasis="strong">{plan.name}</DataTableCell>
                    {showClients ? (
                      <DataTableCell emphasis="soft">{plan.client_name}</DataTableCell>
                    ) : null}
                    <span>
                      {/* A plan left at its questions is a draft like any
                          other from the outside, which is how it gets lost:
                          nothing on the row said it was waiting on a person
                          rather than on the model. */}
                      {plan.draftingState === "asking" ? (
                        <span
                          className="inline-block whitespace-nowrap rounded-full px-2 py-[3px] text-[11.5px] font-medium"
                          style={{
                            background: "var(--warning-bg)",
                            color: "var(--warning-fg)",
                          }}
                        >
                          Waiting on you
                        </span>
                      ) : (
                        <StatusPill status={plan.status} />
                      )}
                    </span>
                    <DataTableCell emphasis="soft">{urgencyLabel(plan.urgency)}</DataTableCell>
                    <span>
                      <HealthPill health={plan.health} />
                    </span>
                    <ProgressMeter
                      percent={plan.progress}
                      done={plan.taskDone}
                      total={plan.taskTotal}
                    />
                    <DataTableCell emphasis="soft">{shortDate(plan.target_date)}</DataTableCell>
                  </DataTableRow>
                ))}
              </ShowMore>
            </DataTable>
          )}
        </>
      )}

      {deleting && links ? (
        <DeletePlanDialog
          planId={deleting.id}
          planName={deleting.name}
          links={links}
          closeHref={LIST}
        />
      ) : null}
    </div>
  );
}
