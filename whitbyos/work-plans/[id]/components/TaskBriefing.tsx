import { Pill } from "@/base/components/Pill";
import type { PlanTask } from "@/whitbyos/lib/work-plans";
import { requirementState } from "@/whitbyos/lib/plan-requirements";

const REQUIREMENT_LABEL: Record<string, string> = {
  document: "Document",
  information: "Information",
  approval: "Approval",
  account: "Account or access",
  contact: "Contact",
};

/**
 * Everything about a task that is not a field somebody types into.
 *
 * A drafted step used to be a title and a date. This is what Whitby now works
 * out alongside it — what the task is, why it is in the plan, what it needs
 * before it can start, what it produces, and where to go — and it is read-only
 * because it is the draft's reasoning rather than the professional's own
 * answer. Everything editable stays in the form below it.
 *
 * Nothing is drawn where there is nothing to draw. A task Whitby never wrote a
 * briefing for shows the form alone rather than a column of empty headings.
 */
export function TaskBriefing({ task }: { task: PlanTask }) {
  const has =
    task.description ||
    task.rationale ||
    task.expectedOutput ||
    task.requiredInputs.length > 0 ||
    task.externalLinks.length > 0 ||
    task.estimatedDays;

  if (!has) return null;

  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-card border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface-subtle)" }}
    >
      {task.description ? (
        <p className="text-[13px] leading-[1.55]" style={{ margin: 0, color: "var(--ink)" }}>
          {task.description}
        </p>
      ) : null}

      {task.rationale ? (
        <Block label="Why this is here">{task.rationale}</Block>
      ) : null}

      {task.requiredInputs.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label>Needed before this can start</Label>
          {task.requiredInputs.map((input, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <Pill tone={input.alreadyHeld === true ? "success" : "neutral"}>
                {REQUIREMENT_LABEL[input.kind] ?? input.kind}
              </Pill>
              <span style={{ color: "var(--ink)" }}>{input.label}</span>
              {/* What the work wants it for. Whoever is doing this step is the
                  one who gets asked, so they should not have to guess either. */}
              {input.why ? (
                <span style={{ color: "var(--text-tertiary)" }}>&mdash; {input.why}</span>
              ) : null}
              {/* Only where it was actually established. "Not held" and "not
                  known" are different answers and the second is the common one.
                  This dialog has no view of the plan's ask, so it reports only
                  what the requirement says about itself; the task screen, which
                  does have it, says whether the client has sent it. */}
              {(() => {
                const state = requirementState(input, null);
                if (!state) return null;
                return (
                  <span
                    style={{
                      color:
                        state.tone === "success"
                          ? "var(--success-fg)"
                          : "var(--text-tertiary)",
                    }}
                  >
                    {state.text}
                  </span>
                );
              })()}
            </div>
          ))}
        </div>
      ) : null}

      {task.expectedOutput ? (
        <Block label="What this produces">{task.expectedOutput}</Block>
      ) : null}

      {task.externalLinks.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <Label>Where to go</Label>
          {task.externalLinks.map((resource, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              {resource.url ? (
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                  style={{ color: "var(--accent)" }}
                >
                  {resource.label}
                </a>
              ) : (
                <span style={{ color: "var(--ink)" }}>{resource.label}</span>
              )}

              {resource.phone ? (
                <a href={`tel:${resource.phone}`} className="no-underline" style={{ color: "var(--accent)" }}>
                  {resource.phone}
                </a>
              ) : null}

              {resource.email ? (
                <a href={`mailto:${resource.email}`} className="no-underline" style={{ color: "var(--accent)" }}>
                  {resource.email}
                </a>
              ) : null}

              {resource.address ? (
                <span style={{ color: "var(--text-tertiary)" }}>{resource.address}</span>
              ) : null}

              {/* The detail was not checked against a source, and saying so is
                  the difference between a useful number and a dangerous one.
                  Only where there is a detail: a resource that is just a name
                  has nothing that could be wrong. */}
              {resource.verified !== true &&
              (resource.phone || resource.email || resource.url || resource.address) ? (
                <Pill tone="neutral">Check before use</Pill>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {task.estimatedDays ? (
        <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Estimated {task.estimatedDays} working day
          {task.estimatedDays === 1 ? "" : "s"}
          {task.startDate ? ` · planned to start ${task.startDate}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-[0.04em]"
      style={{ color: "var(--text-tertiary)" }}
    >
      {children}
    </span>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      <p className="text-[12.5px] leading-[1.55]" style={{ margin: 0, color: "var(--text-secondary)" }}>
        {children}
      </p>
    </div>
  );
}
