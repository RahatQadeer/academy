import "server-only";

import { generateJson } from "./deepseek";
import {
  DESIGNER_SYSTEM,
  briefBlock,
  calibrationBlock,
  jsonDiscipline,
  normalizeDifficulty,
  sourceRulesForRequest,
} from "./prompts";
import type { Blueprint, CatalogGenerationRequest, Objectives } from "./types";
import { looksLikeGenericCourseGen, sourceMentionsGenericCourseGen } from "@/academy/admin/lib/courseAttachmentText";

export async function analyzeBrief(
  request: CatalogGenerationRequest,
  signal?: AbortSignal,
): Promise<Blueprint> {
  const difficulty = normalizeDifficulty(request.difficulty);
  const sourceAware = Boolean(request.source?.hasSource);
  const prompt = `Analyse this course brief before any content is written.

${briefBlock(request)}

${calibrationBlock(difficulty)}

${sourceRulesForRequest(request)}

Your job:
1. Sharpen the title, subtitle and description for a real, specific course${sourceAware ? " whose subject is the SOURCE DOCUMENT, not the user's instruction phrasing." : ""}.
2. Keep difficulty exactly as requested (${difficulty}). Do not upgrade or downgrade it.
3. Map the conceptual structure: what must be understood before what at THIS level.
4. Draw a firm scope boundary that matches the level (beginner still covers a complete skill; advanced does not spend scope on first-day recap).
${sourceAware ? "5. Title and description must name the source document's actual subject. Do not write a course about generating courses, AI prompts, or CourseGen unless that is the source subject." : ""}

Return JSON with keys:
title, subtitle, description, audience, difficulty (must be "${difficulty}"),
prerequisites (string array), estimatedHours (number), domainAnalysis (150-250 words${sourceAware ? " grounded in the source document" : ""}),
inScope (string array), outOfScope (string array).

${jsonDiscipline()}`;

  const result = await generateJson<Blueprint>(DESIGNER_SYSTEM, prompt, {
    temperature: 0.4,
    maxTokens: 4000,
    signal,
  });

  if (!result?.title) {
    throw new Error("Could not analyze the course brief.");
  }

  let blueprint: Blueprint = {
    ...result,
    difficulty,
    prerequisites: Array.isArray(result.prerequisites) ? result.prerequisites : [],
    inScope: Array.isArray(result.inScope) ? result.inScope : [],
    outOfScope: Array.isArray(result.outOfScope) ? result.outOfScope : [],
    estimatedHours: typeof result.estimatedHours === "number" ? result.estimatedHours : 8,
  };

  if (sourceAware && isGenericAgainstSource(blueprint, request)) {
    const retry = await generateJson<Blueprint>(
      DESIGNER_SYSTEM,
      `${prompt}

REWRITE REQUIRED: the previous title/description drifted into a generic AI/course-generation topic. The source subject is "${request.source?.subjectHint || "the attached document"}". Title the course after that subject. Do not mention CourseGen, prompts, or AI course generators.`,
      { temperature: 0.2, maxTokens: 4000, signal },
    );
    if (retry?.title) {
      blueprint = {
        ...retry,
        difficulty,
        prerequisites: Array.isArray(retry.prerequisites) ? retry.prerequisites : blueprint.prerequisites,
        inScope: Array.isArray(retry.inScope) ? retry.inScope : blueprint.inScope,
        outOfScope: Array.isArray(retry.outOfScope) ? retry.outOfScope : blueprint.outOfScope,
        estimatedHours: typeof retry.estimatedHours === "number" ? retry.estimatedHours : blueprint.estimatedHours,
      };
    }
  }

  return blueprint;
}

function isGenericAgainstSource(blueprint: Blueprint, request: CatalogGenerationRequest) {
  const haystack = `${request.source?.consolidated ?? ""} ${request.source?.fullText ?? ""}`;
  if (sourceMentionsGenericCourseGen(haystack)) return false;
  return looksLikeGenericCourseGen(`${blueprint.title} ${blueprint.subtitle} ${blueprint.description}`);
}

export async function generateObjectives(
  request: CatalogGenerationRequest,
  blueprint: Blueprint,
  signal?: AbortSignal,
): Promise<Objectives> {
  const prompt = `Write course-level learning objectives.

COURSE: ${blueprint.title}
DESCRIPTION: ${blueprint.description}
AUDIENCE: ${blueprint.audience}
DOMAIN ANALYSIS: ${blueprint.domainAnalysis}

${briefBlock(request, blueprint)}

${calibrationBlock(blueprint.difficulty)}

Rules:
- 4-8 learningObjectives, each starting with an observable Bloom verb (Explain, Build, Diagnose, Compare, Design…)
- 3-6 outcomes describing deliverables or capabilities after finishing
- Never use vague verbs like "understand" or "learn about"
${request.source?.hasSource ? "- Every objective must map to a concept in the SOURCE DOCUMENT. Do not add unrelated AI/course-building objectives." : ""}

Return JSON with keys: learningObjectives (string array), outcomes (string array).

${jsonDiscipline()}`;

  const result = await generateJson<Objectives>(DESIGNER_SYSTEM, prompt, {
    temperature: 0.6,
    maxTokens: 3000,
    signal,
  });

  if (!result?.learningObjectives?.length) {
    throw new Error("Could not generate learning objectives.");
  }

  return {
    learningObjectives: result.learningObjectives.map(String),
    outcomes: Array.isArray(result.outcomes) ? result.outcomes.map(String) : [],
  };
}
