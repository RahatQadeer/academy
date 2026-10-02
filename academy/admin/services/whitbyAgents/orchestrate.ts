import "server-only";

import type { WhitbyRefineContext } from "../../actions";
import type { PersistedProgramDraft } from "../catalogPersistence";
import { applyWhitbyOps, emptyPersistedModule } from "./apply";
import { runAssignmentAgent } from "./assignmentAgent";
import { runChatAgent } from "./chatAgent";
import { splitCompoundInstruction } from "./compound";
import { findReferenceIssue } from "./references";
import { runEmbedAgent } from "./embedAgent";
import { runMutateAgent } from "./mutateAgent";
import { runOverviewAgent } from "./overviewAgent";
import { runQuizAgent } from "./quizAgent";
import { routeWhitbyInstructionWithModel } from "./router";
import { runLessonAgent, runStructureAgent } from "./structureAgent";
import type { OrchestratedRefine, WhitbyAgentResult, WhitbyIntent, WhitbyPlan } from "./types";
import { runVideoAgent } from "./videoAgent";
import { refineLessonWithWhitby, refineProgramWithWhitby } from "../whitbyRefineEngine";
import { draftsMeaningfullyEqual, noChangeStyleSummary } from "./draftFingerprint";

const HEAVY_INTENTS: WhitbyIntent[] = ["rewrite_program", "edit_lesson", "answer"];

function withMutationFlag(
  before: PersistedProgramDraft,
  after: (PersistedProgramDraft & { summary: string }) | null,
  instruction: string,
): OrchestratedRefine | null {
  if (!after) return null;
  if (draftsMeaningfullyEqual(before, after)) {
    return {
      ...before,
      summary: noChangeStyleSummary(instruction, after.summary),
      mutated: false,
    };
  }
  return { ...after, mutated: true };
}

function ensureModule(draft: PersistedProgramDraft, plan: WhitbyPlan): WhitbyPlan {
  if (draft.modules.length > 0) return plan;
  draft.modules.push(emptyPersistedModule(draft.name.trim() || "Module 1", []));
  return { ...plan, moduleIndex: 0, lessonIndex: null };
}

function lessonContext(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
  context?: WhitbyRefineContext,
): WhitbyRefineContext | null {
  const moduleIndex = plan.moduleIndex ?? context?.moduleIndex;
  const lessonIndex = plan.lessonIndex ?? context?.lessonIndex;
  if (moduleIndex == null || lessonIndex == null) return null;
  const module = draft.modules[moduleIndex];
  const lesson = module?.lessons[lessonIndex];
  if (!lesson) return null;
  return {
    focus: "lesson",
    moduleIndex,
    lessonIndex,
    moduleTitle: module.title,
    lessonTitle: lesson.title,
  };
}

async function runAgent(
  intent: WhitbyIntent,
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
  context?: WhitbyRefineContext,
): Promise<WhitbyAgentResult | OrchestratedRefine | null> {
  switch (intent) {
    case "remove_lesson":
    case "remove_module":
    case "remove_assignment":
    case "rename_item":
      return runMutateAgent(draft, { ...plan, intents: [intent] }, context);
    case "answer":
      return runChatAgent(draft, plan, context);
    case "embed_content":
      return runEmbedAgent(draft, plan);
    case "add_quiz":
    case "expand_quiz":
      return runQuizAgent(draft, { ...plan, intents: [intent] });
    case "add_assignment":
      return runAssignmentAgent(draft, plan);
    case "add_video":
      return runVideoAgent(draft, plan);
    case "add_lessons":
      return runLessonAgent(draft, plan);
    case "add_module":
      return runStructureAgent(draft, plan);
    case "edit_overview":
      return runOverviewAgent(draft, plan);
    case "edit_lesson": {
      const focused = lessonContext(draft, plan, context);
      if (!focused) {
        return {
          ...draft,
          summary: "Which lesson should I edit? Select it in the outline first.",
          mutated: false,
        };
      }
      return withMutationFlag(
        draft,
        await refineLessonWithWhitby(draft, plan.notes, focused),
        plan.notes,
      );
    }
    case "rewrite_program":
      return withMutationFlag(
        draft,
        await refineProgramWithWhitby(draft, plan.notes, context),
        plan.notes,
      );
    default:
      return null;
  }
}

function isFullDraft(
  value: WhitbyAgentResult | OrchestratedRefine | null,
): value is OrchestratedRefine {
  return Boolean(value && "modules" in value && "summary" in value && !("ops" in value));
}

export async function orchestrateWhitbyRefine(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext,
): Promise<OrchestratedRefine | null> {
  // A compound request ("remove 1.2 and add a lesson") is executed clause by
  // clause, threading the draft so each step builds on the previous one. The
  // splitter returns a single clause for ordinary instructions, so the common
  // path is unchanged.
  const clauses = splitCompoundInstruction(instruction, draft, context);
  if (clauses.length <= 1) {
    return runInstruction(draft, instruction, context);
  }

  let working: PersistedProgramDraft = structuredClone(draft);
  const summaries: string[] = [];
  let mutated = false;
  let produced = false;

  for (const clause of clauses) {
    const result = await runInstruction(working, clause, context);
    if (!result) continue;
    produced = true;
    working = result;
    if (result.mutated !== false) mutated = true;
    const summary = result.summary?.trim();
    if (summary) summaries.push(summary);
  }

  if (!produced) {
    // No clause resolved on its own — fall back to routing the whole thing.
    return runInstruction(draft, instruction, context);
  }

  return { ...working, summary: summaries.join(" "), mutated };
}

async function runInstruction(
  draft: PersistedProgramDraft,
  instruction: string,
  context?: WhitbyRefineContext,
): Promise<OrchestratedRefine | null> {
  let working = structuredClone(draft);

  // Never guess an explicit outline position that doesn't exist — ask instead.
  const issue = findReferenceIssue(instruction, working);
  if (issue) {
    return { ...working, summary: issue.message, mutated: false };
  }

  const plan = ensureModule(
    working,
    await routeWhitbyInstructionWithModel(instruction, working, context),
  );

  if (plan.intents.includes("answer") && plan.intents.every((intent) => intent === "answer")) {
    return runChatAgent(working, plan, context);
  }

  if (plan.intents.includes("rewrite_program") && plan.intents.every((intent) => HEAVY_INTENTS.includes(intent))) {
    return withMutationFlag(
      working,
      await refineProgramWithWhitby(working, instruction, context),
      instruction,
    );
  }

  if (plan.intents.includes("edit_lesson") && plan.intents.every((intent) => HEAVY_INTENTS.includes(intent))) {
    const focused = lessonContext(working, plan, context);
    if (!focused) {
      return {
        ...working,
        summary: "Which lesson should I edit? Select it in the outline first.",
        mutated: false,
      };
    }
    // Prefer plan.notes so format-only / deepen wrappers reach the lesson writer.
    return withMutationFlag(
      working,
      await refineLessonWithWhitby(working, plan.notes || instruction, focused),
      plan.notes || instruction,
    );
  }

  const intents = plan.intents.filter((intent) => intent !== "answer" && intent !== "rewrite_program");
  const summaries: string[] = [];
  let mutated = false;

  for (const intent of intents.length ? intents : plan.intents) {
    const result = await runAgent(intent, working, plan, context);
    if (!result) continue;

    if (isFullDraft(result)) {
      working = result;
      summaries.push(result.summary);
      mutated = result.mutated !== false;
      continue;
    }

    if (result.ops.length === 0) {
      summaries.push(result.summary);
      continue;
    }

    const applied = applyWhitbyOps(working, result.ops, result.summary);
    if (!applied) {
      // The ops targeted stale indices or supplied blank content, so nothing
      // changed. Don't echo the agent's optimistic summary as if it applied.
      summaries.push("I couldn’t apply that outline change — the target may have moved. Try naming the module or lesson number.");
      continue;
    }
    working = applied;
    summaries.push(result.summary);
    mutated = true;
  }

  if (summaries.length === 0) {
    return runChatAgent(working, plan, context);
  }

  return { ...working, summary: summaries.join(" "), mutated };
}
