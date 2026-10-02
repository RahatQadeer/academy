import "server-only";

import type { WhitbyRefineContext } from "../../actions";
import type { PersistedProgramDraft } from "../catalogPersistence";
import { isRefinementDraftValid } from "../catalogQuality";
import { critiqueRefinement } from "./critic";
import { orchestrateWhitbyRefine } from "./orchestrate";
import { classifyRisk, type RiskAssessment } from "./risk";
import type { OrchestratedRefine } from "./types";

// Deterministic workflow runner around the Whitby orchestrator. It adds the
// guarantees the raw orchestrator lacks: a bounded state machine (so it can
// never loop), a hard wall-clock timeout, an independent VALIDATING gate, a
// capped REVISION retry, and an honest final state — success is only reported
// once the draft has actually passed validation (the caller then COMMITs it to
// the database). A structured trace is emitted for audit/observability.

export type WorkflowState =
  | "received"
  | "understanding"
  | "planning"
  | "executing"
  | "validating"
  | "revision"
  | "committing"
  | "completed"
  | "no_change"
  | "aborted";

export type WorkflowLimits = {
  /** Max VALIDATING → REVISION → VALIDATING cycles before aborting. */
  maxRevisions: number;
  /** Wall-clock ceiling for the whole workflow. */
  timeoutMs: number;
};

export const DEFAULT_WORKFLOW_LIMITS: WorkflowLimits = {
  maxRevisions: 1,
  timeoutMs: 90_000,
};

export type WorkflowStep = {
  state: WorkflowState;
  detail: string;
  at: number;
};

export type WorkflowTrace = {
  workflowId: string;
  instruction: string;
  risk: RiskAssessment;
  steps: WorkflowStep[];
  finalState: WorkflowState;
  revisions: number;
  durationMs: number;
};

export type WorkflowOutcome = {
  /** Committed & validated change, unchanged draft (chat/no-op), or a hard failure. */
  status: "completed" | "no_change" | "aborted";
  /** Present unless the workflow aborted before producing a draft. */
  draft: OrchestratedRefine | null;
  reason: "ok" | "timeout" | "invalid" | "empty" | "failed";
  risk: RiskAssessment;
  trace: WorkflowTrace;
};

const TIMEOUT = Symbol("workflow-timeout");

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function runWhitbyWorkflow(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext & { programStatus?: string },
  limits: WorkflowLimits = DEFAULT_WORKFLOW_LIMITS,
): Promise<WorkflowOutcome> {
  const startedAt = Date.now();
  const steps: WorkflowStep[] = [];
  const risk = classifyRisk(instruction, context);
  const workflowId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `wf_${startedAt}`;

  const record = (state: WorkflowState, detail: string) => {
    steps.push({ state, detail, at: Date.now() - startedAt });
  };

  const finish = (
    finalState: WorkflowState,
    status: WorkflowOutcome["status"],
    reason: WorkflowOutcome["reason"],
    result: OrchestratedRefine | null,
    revisions: number,
  ): WorkflowOutcome => {
    record(finalState, reason);
    return {
      status,
      draft: result,
      reason,
      risk,
      trace: {
        workflowId,
        instruction,
        risk,
        steps,
        finalState,
        revisions,
        durationMs: Date.now() - startedAt,
      },
    };
  };

  record("received", instruction.slice(0, 120));
  record("understanding", `risk=${risk.level}`);

  let revisions = 0;

  // EXECUTING → VALIDATING → (bounded) REVISION. The loop can run at most
  // maxRevisions + 1 times, so it is guaranteed to terminate (anti-loop).
  while (true) {
    record(revisions === 0 ? "planning" : "revision", `attempt ${revisions + 1}`);
    record("executing", "orchestrating agents");

    const remaining = limits.timeoutMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      return finish("aborted", "aborted", "timeout", null, revisions);
    }

    let orchestrated: OrchestratedRefine | null | typeof TIMEOUT;
    try {
      orchestrated = await withTimeout(
        orchestrateWhitbyRefine(draft, instruction, context),
        remaining,
      );
    } catch (error) {
      console.error("[whitby.workflow] execute failed", error);
      return finish("aborted", "aborted", "failed", null, revisions);
    }

    if (orchestrated === TIMEOUT) {
      return finish("aborted", "aborted", "timeout", null, revisions);
    }

    if (!orchestrated) {
      return finish("aborted", "aborted", "empty", null, revisions);
    }

    // A chat/answer or a batch that changed nothing — a legitimate, honest
    // "no change" outcome, never reported as a mutation.
    if (orchestrated.mutated === false) {
      return finish("no_change", "no_change", "ok", orchestrated, revisions);
    }

    record("validating", "critic: dedupe + quiz checks");
    const critique = critiqueRefinement(draft, orchestrated);
    const reviewed = critique.draft;
    if (isRefinementDraftValid(reviewed)) {
      record("committing", "handing off to persistence");
      const summary =
        critique.notes.length > 0
          ? `${reviewed.summary} ${critique.notes.join(" ")}`.trim()
          : reviewed.summary;
      return finish("completed", "completed", "ok", { ...reviewed, summary }, revisions);
    }

    // Invalid draft. Retry once if we still have a revision budget; otherwise
    // abort honestly rather than persisting a broken structure.
    if (revisions >= limits.maxRevisions) {
      return finish("aborted", "aborted", "invalid", null, revisions);
    }
    revisions += 1;
  }
}

/** Structured audit line for observability (durable audit table deferred). */
export function logWorkflowTrace(trace: WorkflowTrace): void {
  console.info(
    "[whitby.workflow]",
    JSON.stringify({
      workflowId: trace.workflowId,
      finalState: trace.finalState,
      risk: trace.risk.level,
      requiresApproval: trace.risk.requiresApproval,
      revisions: trace.revisions,
      durationMs: trace.durationMs,
      steps: trace.steps.map((step) => `${step.state}@${step.at}ms`),
    }),
  );
}
