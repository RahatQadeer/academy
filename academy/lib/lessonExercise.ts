/**
 * Inline drag-and-drop fill-in exercises embedded in lesson contentBody.
 * Fence language: ```exercise
 *
 * PROMPT: …          ← learner instruction (must not name the answer)
 * CODE:              ← snippet with [[ ]] blank
 * …code…
 * OPTIONS: a | b | c | d
 * ANSWER: c          ← never shown until the learner submits correctly or taps Show answer
 * EXPLANATION: …     ← optional teaching note; only shown via Show answer
 */

export type LessonExercise = {
  prompt: string;
  code: string;
  options: string[];
  answer: string;
  /** Teaching rationale — never printed in the lesson body outside this field. */
  explanation?: string;
};

export const EXERCISE_BLANK = "[[ ]]";

/** Prompt fragment for Whitby / catalog generation. */
export const EXERCISE_FORMAT_RULES = `INTERACTIVE EXERCISE (include one in every reading, scenario, resource, and video lesson — skip pure quiz/assignment lessons):
Emit a content block with type "exercise" OR a fenced \`\`\`exercise block in contentBody using this exact shape:

\`\`\`exercise
PROMPT: Drag and drop the correct [token] to complete the example. (Describe the goal — never name the correct option.)
CODE:
example {
  ${EXERCISE_BLANK} : value;
}
OPTIONS: distractor-a | distractor-b | distractor-c | correct-option
ANSWER: correct-option
EXPLANATION: One or two sentences that teach why that option is right (shown only when the learner taps Show answer).
\`\`\`

CRITICAL — NO SPOILERS IN THE LESSON BODY:
- After the closing \`\`\` of an exercise, do NOT write any paragraph that states, restates, or hints the ANSWER.
- Never write “the answer is…”, “the complete form is…”, “so its value is <ANSWER>”, or similar immediately after the exercise.
- Put all teaching rationale only in EXPLANATION inside the fence. The UI hides it behind Show answer.
- PROMPT must not contain the ANSWER text or say "the answer is…".
- Exactly one blank marked ${EXERCISE_BLANK} inside CODE.
- 3–5 OPTIONS; ANSWER must be one of them (exact string match).
- Prefer code, config, formula, or short phrase tokens that fit the lesson topic.
- This is formative practice: learners drag/tap a chip into the blank, then submit — or tap Show answer if stuck.`;

const BLANK_PATTERN = /\[\[\s*\]\]|\{\{\s*blank\s*\}\}|_{3,}/i;

export function hasExerciseBlank(code: string): boolean {
  return BLANK_PATTERN.test(code);
}

export function normalizeExerciseBlank(code: string): string {
  return code.replace(BLANK_PATTERN, EXERCISE_BLANK);
}

export function parseExerciseFence(raw: string): LessonExercise | null {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return null;

  const promptMatch = text.match(/^PROMPT:\s*([\s\S]+?)(?=\nCODE:|\nOPTIONS:|\nANSWER:|\nEXPLANATION:|$)/i);
  const codeMatch = text.match(/\nCODE:\s*\n([\s\S]*?)(?=\nOPTIONS:|\nANSWER:|\nEXPLANATION:|$)/i);
  const optionsMatch = text.match(/\nOPTIONS:\s*([\s\S]+?)(?=\nANSWER:|\nEXPLANATION:|$)/i);
  const answerMatch = text.match(/\nANSWER:\s*([^\n]+)/i);
  const explanationMatch = text.match(/\nEXPLANATION:\s*([\s\S]+?)\s*$/i);

  // Alternate compact shape: prompt \n ---\n code \n ---\n options \n ---\n answer [\n ---\n explanation]
  if (!promptMatch || !codeMatch || !optionsMatch || !answerMatch) {
    const parts = text.split(/\n---\n/);
    if (parts.length >= 4) {
      const prompt = parts[0].replace(/^PROMPT:\s*/i, "").trim();
      const code = normalizeExerciseBlank(parts[1].replace(/^CODE:\s*/i, "").trim());
      const options = splitOptions(parts[2].replace(/^OPTIONS:\s*/i, "").trim());
      const answer = parts[3].replace(/^ANSWER:\s*/i, "").trim();
      const explanation = parts[4]?.replace(/^EXPLANATION:\s*/i, "").trim() || undefined;
      return validateExercise({ prompt, code, options, answer, explanation });
    }
    return null;
  }

  const prompt = promptMatch[1].trim();
  const code = normalizeExerciseBlank(codeMatch[1].trim());
  const options = splitOptions(optionsMatch[1].trim());
  const answer = answerMatch[1].trim();
  const explanation = explanationMatch?.[1]?.trim() || undefined;

  return validateExercise({ prompt, code, options, answer, explanation });
}

function splitOptions(raw: string): string[] {
  return raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function validateExercise(exercise: LessonExercise): LessonExercise | null {
  if (!exercise.prompt || !exercise.code || !hasExerciseBlank(exercise.code)) return null;
  if (exercise.options.length < 2) return null;
  if (!exercise.answer || !exercise.options.includes(exercise.answer)) return null;
  return {
    prompt: exercise.prompt,
    code: normalizeExerciseBlank(exercise.code),
    options: exercise.options,
    answer: exercise.answer,
    explanation: exercise.explanation?.trim() || undefined,
  };
}

export function formatExerciseFence(exercise: LessonExercise): string {
  const normalized = validateExercise(exercise);
  if (!normalized) return "";
  const lines = [
    "```exercise",
    `PROMPT: ${normalized.prompt}`,
    "CODE:",
    normalized.code,
    `OPTIONS: ${normalized.options.join(" | ")}`,
    `ANSWER: ${normalized.answer}`,
  ];
  if (normalized.explanation) {
    lines.push(`EXPLANATION: ${normalized.explanation}`);
  }
  lines.push("```");
  return lines.join("\n");
}

/** Deterministic shuffle so SSR and client match. */
export function shuffleExerciseOptions(options: string[], seed: string): string[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const arr = [...options];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = (h >>> 0) % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when a paragraph after an exercise gives away the blank. */
export function isExerciseAnswerSpoiler(paragraph: string, answer: string): boolean {
  const text = paragraph.trim();
  if (!text || text.startsWith("```") || /^#{1,6}\s/.test(text)) return false;

  if (
    /\b(?:the\s+(?:correct|right|complete)\s+(?:answer|option|form|value)|answer\s+is|correct\s+option\s+is|so\s+its?\s+value\s+is|complete\s+expanded\s+form\s+is)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  const ans = answer.trim();
  if (!ans || ans.length < 1) return false;

  const token = new RegExp(`(?:^|[^\\w])${escapeRegExp(ans)}(?:[^\\w]|$)`);
  if (!token.test(text)) return false;

  // Answer token appears in a short teaching paragraph right after the exercise.
  if (text.length <= 500) return true;
  return /\b(?:therefore|so\s+(?:the|its)|because|hence|thus|value\s+is|form\s+is)\b/i.test(text);
}

/**
 * Move spoiler paragraphs that follow an exercise fence into EXPLANATION
 * (hidden behind Show answer) so the lesson body does not give the answer away.
 */
export function foldExerciseSpoilers(body: string): string {
  if (!body.includes("```exercise")) return body;

  return body.replace(
    /```exercise\s*\n?([\s\S]*?)```((?:\n(?!##\s|```)[^\n]*)*)/gi,
    (full, inner: string, trailing: string) => {
      const exercise = parseExerciseFence(inner);
      if (!exercise) return full;

      const chunks = trailing.split(/\n{2,}/);
      const kept: string[] = [];
      const spoilers: string[] = [];

      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        if (isExerciseAnswerSpoiler(trimmed, exercise.answer)) {
          spoilers.push(trimmed.replace(/\s+/g, " "));
        } else {
          kept.push(chunk.replace(/^\n+/, "").replace(/\n+$/, ""));
        }
      }

      let nextInner = inner.replace(/\s+$/, "");
      if (spoilers.length > 0) {
        const folded = spoilers.join(" ");
        if (/\nEXPLANATION:\s*/i.test(nextInner)) {
          nextInner = nextInner.replace(
            /\nEXPLANATION:\s*([\s\S]*?)\s*$/i,
            (_m, existing: string) => {
              const base = existing.trim();
              return `\nEXPLANATION: ${base}${base ? " " : ""}${folded}`;
            },
          );
        } else {
          nextInner = `${nextInner}\nEXPLANATION: ${folded}`;
        }
      }

      const keptTrailing = kept.length > 0 ? `\n\n${kept.join("\n\n")}` : "";
      return `\`\`\`exercise\n${nextInner}\n\`\`\`${keptTrailing}`;
    },
  );
}
