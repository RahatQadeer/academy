"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Callout } from "@/base/components/Callout";
import { buildFromPlaybook } from "@/whitbyos/work-plans/actions";
import { COMPLEXITIES, URGENCIES } from "@/whitbyos/lib/plan-config-vocab";

const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[13.5px] text-ink";
const LABEL = "text-[12.5px] font-medium text-[color:var(--text-tertiary)]";

/**
 * WP.9 — Configure, for the Playbook path, and WP.10 while it runs.
 *
 * A client component for the same reason the Whitby path's is: the Generating
 * screen is this screen's own pending state, and a server component cannot
 * know its form is in flight.
 *
 * WP.10 exists here even though nothing is generated — copying a Playbook's
 * Work Streams, its providers and its templates is several writes, and a
 * screen that appears to do nothing while they run is one people click twice.
 */
export function PlaybookConfigure({
  clientId,
  playbook,
  requests,
  name,
  error,
}: {
  clientId: string;
  playbook: {
    id: string;
    name: string;
    streamCount: number;
    taskCount: number;
  };
  requests: { id: string; title: string; clientName?: string | null }[];
  /** A name typed on WP.3, which this screen's own field starts from. */
  name: string;
  error?: string;
}) {
  const [urgency, setUrgency] = useState(1);
  const [complexity, setComplexity] = useState("moderate");

  return (
    <form action={buildFromPlaybook} className="flex flex-1 flex-col">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="playbook_id" value={playbook.id} />
      <input type="hidden" name="urgency" value={URGENCIES[urgency].value} />
      <input type="hidden" name="complexity" value={complexity} />

      <Body
        playbook={playbook}
        requests={requests}
        name={name}
        error={error}
        urgency={urgency}
        onUrgency={setUrgency}
        complexity={complexity}
        onComplexity={setComplexity}
      />
    </form>
  );
}

function Body({
  playbook,
  requests,
  name,
  error,
  urgency,
  onUrgency,
  complexity,
  onComplexity,
}: {
  playbook: { name: string; streamCount: number; taskCount: number };
  requests: { id: string; title: string; clientName?: string | null }[];
  name: string;
  error?: string;
  urgency: number;
  onUrgency: (value: number) => void;
  complexity: string;
  onComplexity: (value: string) => void;
}) {
  const { pending } = useFormStatus();
  if (pending) return <Applying playbook={playbook} />;

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8 sm:py-10 xl:px-10">
      <div className="flex w-full max-w-[640px] flex-col gap-[22px] rounded-card border border-line bg-surface p-9">
        <div>
          <h1 className="mb-1 text-[21px] font-bold">
            Configure this Work Plan
          </h1>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            From Playbook:{" "}
            <strong className="font-semibold" style={{ color: "var(--ink)" }}>
              {playbook.name}
            </strong>
          </p>
        </div>

        {error ? <Callout tone="danger">{error}</Callout> : null}

        {/* The reference counts providers, templates and forms here too. A
          Playbook's contents hold Work Streams and their tasks and nothing
          else, so those three would be numbers with nothing behind them. */}
        <div
          className="rounded-[8px] px-3.5 py-3 text-[12.5px]"
          style={{
            background: "var(--surface-soft)",
            color: "var(--text-muted)",
          }}
        >
          Carrying over: {playbook.streamCount} Work Stream
          {playbook.streamCount === 1 ? "" : "s"} · {playbook.taskCount} Task
          {playbook.taskCount === 1 ? "" : "s"}
        </div>

        <div className="flex flex-col gap-2.5">
          <span className={LABEL}>Urgency</span>

          <div className="px-0.5 pt-2.5">
            <input
              type="range"
              min={0}
              max={URGENCIES.length - 1}
              step={1}
              value={urgency}
              onChange={(event) => onUrgency(Number(event.target.value))}
              aria-label="Urgency"
              aria-valuetext={URGENCIES[urgency].label}
              className="pa-slider"
              style={{
                ["--fill" as string]: `${(urgency / (URGENCIES.length - 1)) * 100}%`,
              }}
            />

            <div className="mt-2.5 flex justify-between">
              {URGENCIES.map((option, index) => (
                <span
                  key={option.value}
                  className="text-[11.5px]"
                  style={
                    index === urgency
                      ? { color: "var(--accent)", fontWeight: 600 }
                      : { color: "var(--text-faint)" }
                  }
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className={LABEL}>Complexity</span>
          <div className="flex gap-2">
            {COMPLEXITIES.map((option) => {
              const on = option.value === complexity;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onComplexity(option.value)}
                  aria-pressed={on}
                  className="flex-1 rounded-control px-2.5 py-[9px] text-center text-[12.5px] font-medium"
                  style={
                    on
                      ? {
                          background: "var(--accent-tint)",
                          color: "var(--accent)",
                          border: "1.5px solid rgba(35,131,226,.2)",
                        }
                      : {
                          background: "var(--surface)",
                          color: "rgba(55,53,47,.55)",
                          border: "1px solid var(--border-strong)",
                        }
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="request_id">
            Link to Request{" "}
            <span
              className="font-normal"
              style={{ color: "var(--text-quiet)" }}
            >
              (optional)
            </span>
          </label>
          <select
            id="request_id"
            name="request_id"
            defaultValue=""
            className={CONTROL}
          >
            <option value="">None, standalone Work Plan</option>
            {requests.map((request) => (
              <option key={request.id} value={request.id}>
                {request.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="name">
            Plan name{" "}
            <span
              className="font-normal"
              style={{ color: "var(--text-quiet)" }}
            >
              (optional, the Playbook&apos;s name is used otherwise)
            </span>
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            className={CONTROL}
            placeholder={playbook.name}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="target_date">
            Target Completion
          </label>
          <input
            id="target_date"
            name="target_date"
            type="date"
            className={CONTROL}
          />
        </div>

        <button
          type="submit"
          className="self-end rounded-control px-[18px] py-[11px] text-[14px] font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          Apply Playbook →
        </button>
      </div>
    </div>
  );
}

/** WP.10 — what the wait looks like. */
function Applying({
  playbook,
}: {
  playbook: { streamCount: number; taskCount: number };
}) {
  const steps = [
    `Copied ${playbook.streamCount} Work Stream${playbook.streamCount === 1 ? "" : "s"} from Playbook`,
    `Copied ${playbook.taskCount} Task${playbook.taskCount === 1 ? "" : "s"} and their checklists`,
    "Adjusting task dates to target completion…",
    "Finalizing plan",
  ];

  return (
    <div
      className="flex flex-1 items-center justify-center px-10 py-12"
      style={{ background: "#fafafa" }}
    >
      <div className="flex w-full max-w-[520px] flex-col items-center gap-[22px] rounded-card border border-line bg-surface p-9 text-center">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-[10px]"
          style={{ background: "var(--ink)" }}
          aria-hidden
        >
          <span className="text-[18px] font-bold text-white">W</span>
        </div>

        <div>
          <div className="mb-1 text-[18px] font-bold">
            Applying Playbook structure
          </div>
          <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            This usually takes under a minute.
          </div>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-[3px]"
          style={{ background: "var(--border)" }}
          role="progressbar"
          aria-label="Applying Playbook structure"
        >
          <div
            className="pa-progress-indeterminate h-full"
            style={{ background: "var(--accent)" }}
          />
        </div>

        <div className="flex w-full flex-col gap-2.5 text-left">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center gap-2.5">
              <span
                className="w-[18px] shrink-0 text-[13px]"
                style={{
                  color:
                    index < 2
                      ? "var(--success-fg)"
                      : index === 2
                        ? "var(--accent)"
                        : "rgba(55,53,47,.3)",
                }}
                aria-hidden
              >
                {index < 2 ? (
                  "✓"
                ) : index === 2 ? (
                  <span className="pa-step-running">◐</span>
                ) : (
                  "○"
                )}
              </span>
              <span
                className="text-[13px]"
                style={{
                  color: index > 2 ? "var(--text-quiet)" : "var(--ink)",
                }}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
