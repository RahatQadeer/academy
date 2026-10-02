"use client";

import { useState } from "react";
import type { ClientOption, PlaybookOption } from "@/whitbyos/lib/requests";
import {
  DraftButton,
  DraftingOverlay,
} from "@/whitbyos/requests/components/DraftButton";

/**
 * The hero on the Requests screen (Figma 06): describe the work in plain
 * language and let Whitby draft a plan from it (SRS §6.5.1).
 *
 * Attach file and Add playbook are drawn as the design has them but are not
 * wired, so they are visibly inert rather than clickable and dead.
 */
export function RequestPrompt({
  clients,
  playbooks,
  action,
  defaultPrompt,
}: {
  clients: ClientOption[];
  playbooks: PlaybookOption[];
  action: (formData: FormData) => void;
  /** Carried over from the Dashboard's Ask Whitby bar. */
  defaultPrompt?: string;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");

  return (
    <div className="mb-9 flex flex-col items-center gap-4 text-center">
      <h2 className="text-[20px] font-bold">What do you need help with?</h2>
      <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        Describe the request in plain language, Whitby will draft a plan to review.
      </p>

      <form
        action={action}
        className="w-full max-w-[720px] rounded-card border border-line-strong bg-surface p-4 text-left"
        style={{ boxShadow: "0 1px 3px rgba(15,15,15,.06)" }}
      >
        <DraftingOverlay>
          <textarea
            name="prompt"
            defaultValue={defaultPrompt}
            required
            rows={2}
            placeholder="Coordinate schooling options for the Hartwell children ahead of their move to London this fall."
            className="min-h-[44px] w-full resize-y border-none bg-transparent text-[14.5px] text-ink outline-none placeholder:text-[rgba(55,53,47,0.35)]"
          />
        </DraftingOverlay>

        <input type="hidden" name="client_id" value={clientId} />

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <InertChip>📎 Attach file</InertChip>
          <InertChip>▤ Add playbook</InertChip>

          {/* The deadline, which changes what the plan is rather than
              describing it. With one, the scheduler works backwards from it and
              every task gets a real date; without one, Whitby's own rough
              ordering stands. It sits with the client because both are things
              about the work rather than the words. */}
          <label
            className="flex items-center gap-1.5 rounded-control px-3 py-1.5 text-[12.5px]"
            style={{
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              color: "var(--text-secondary)",
            }}
          >
            <span>Due</span>
            <input
              type="date"
              name="target_date"
              aria-label="Due date"
              className="border-none bg-transparent text-[12.5px] outline-none"
              style={{ color: "var(--ink)" }}
            />
          </label>

          {clients.length > 0 ? (
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              aria-label="Client"
              className="rounded-control px-3 py-1.5 text-[12.5px]"
              style={{
                border: "1px solid var(--accent)",
                background: "var(--accent-tint-mid)",
                color: "var(--accent-hover)",
              }}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          ) : (
            <InertChip>Add a client first</InertChip>
          )}

          <DraftButton disabled={clients.length === 0} />
        </div>
      </form>

      {playbooks.length > 0 ? (
        <div className="w-full max-w-[720px] text-left">
          <div
            className="mb-2.5 text-[13px] font-semibold"
            style={{ color: "var(--text-tertiary)" }}
          >
            Or start from a playbook
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {playbooks.map((playbook) => (
              <div
                key={playbook.id}
                className="rounded-[8px] border border-line p-3.5"
              >
                <div className="text-[13.5px] font-medium">{playbook.name}</div>
                <div
                  className="mt-1 text-[12px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {playbook.stepCount} {playbook.stepCount === 1 ? "step" : "steps"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InertChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-control border border-line px-3 py-1.5 text-[12.5px]"
      style={{ color: "var(--text-disabled)" }}
      title="Not available yet"
    >
      {children}
    </span>
  );
}
