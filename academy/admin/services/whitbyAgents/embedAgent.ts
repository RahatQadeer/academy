import "server-only";

import type { PersistedLesson, PersistedProgramDraft } from "../catalogPersistence";
import { generateJson } from "../catalogPipeline/deepseek";
import { lessonLabel } from "./locator";
import type { WhitbyAgentResult, WhitbyPlan } from "./types";

function scenarioBlock(title: string, body: string) {
  const cleanBody = body.trim();
  const hasDecision = /\bDecision\s*:/i.test(cleanBody);
  const hasAnswer = /\bRecommended answer\s*:/i.test(cleanBody);
  if (hasDecision || hasAnswer) {
    return `Scenario — ${title.trim()}\n${cleanBody}`;
  }
  return [
    `Scenario — ${title.trim()}`,
    cleanBody,
    "Decision: What should you do next in this situation?",
    "Recommended answer: Apply the lesson’s core method, then check the outcome against the success criteria.",
  ].join("\n");
}

function appendBlock(existing: string, block: string) {
  const current = existing.trim();
  return current ? `${current}\n\n${block}` : block;
}

export async function runEmbedAgent(
  draft: PersistedProgramDraft,
  plan: WhitbyPlan,
): Promise<WhitbyAgentResult> {
  const moduleIndex = plan.moduleIndex ?? 0;
  const lessonIndex = plan.lessonIndex;
  const module = draft.modules[moduleIndex];
  const lesson = lessonIndex != null ? module?.lessons[lessonIndex] : null;

  if (!module || lessonIndex == null || !lesson) {
    return {
      agent: "embed",
      ops: [],
      summary: "Which lesson should I add that to? Name it, like lesson 1.1, or select it in the outline.",
    };
  }

  let title = `${lesson.title} in practice`;
  let body = `Apply the ideas from “${lesson.title}” to a real situation. Decide what you would do first, what you would check, and how you would confirm the result.`;

  try {
    const result = await generateJson<{ title?: string; body?: string }>(
      `You write one Scenario block for an existing Academy lesson. Do not rewrite the lesson. Return JSON: { "title": "short case title", "body": "2-4 short paragraphs of the case, with a decision or practice task" }`,
      `Program: ${draft.name}
Module: ${module.title}
Lesson: ${lesson.title}
Lesson summary: ${lesson.contentSummary || lesson.contentBody.slice(0, 500)}
Instructor: ${plan.notes}`,
      { temperature: 0.4, maxTokens: 1600, timeoutMs: 20_000 },
    );
    if (result?.title?.trim()) title = result.title.trim();
    if (result?.body?.trim()) body = result.body.trim();
  } catch {
    /* keep the fallback scenario so the outline still updates */
  }

  const updated: PersistedLesson = {
    ...lesson,
    contentBody: appendBlock(lesson.contentBody, scenarioBlock(title, body)),
  };

  return {
    agent: "embed",
    summary: `Added a scenario section to ${lessonLabel(draft, moduleIndex, lessonIndex)}.`,
    ops: [
      {
        kind: "replace_lesson",
        moduleIndex,
        lessonIndex,
        lesson: updated,
      },
    ],
  };
}
