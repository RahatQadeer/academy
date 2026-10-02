/**
 * Keep quiz prompts learner-safe: never leave answer keys or explanations
 * inside questionText (those belong in correctAnswer / instructor-only fields).
 */

const ANSWER_LEAK_SPLIT =
  /\n\s*(?:Explanation|Answer key|Correct answer|The answer is|Answer)\s*[:—-]\s*/i;

export function stripQuizAnswerLeaks(questionText: string): string {
  const raw = questionText.trim();
  if (!raw) return raw;

  const [prompt] = raw.split(ANSWER_LEAK_SPLIT);
  return prompt
    .replace(/\s*\((?:correct|answer)\)\s*$/i, "")
    .replace(/\b(?:correct answer|the answer is)\b[^.?!]*[.?!]?\s*$/i, "")
    .trim();
}
