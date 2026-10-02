export const SYNTHETIC_LESSON_MARKER = "is a working decision in this lesson, not a label to memorize";

export function expandPlanToLessonBody(plan: {
  title: string;
  summary: string;
  lessonKind?: string;
  learningObjectives: string[];
  outline: string[];
}): string {
  const beats =
    plan.outline.map((item) => item.trim()).filter(Boolean).length > 0
      ? plan.outline.map((item) => item.trim()).filter(Boolean)
      : plan.learningObjectives.map((item) => item.trim()).filter(Boolean);
  const sections = (beats.length ? beats : [plan.title]).map((beat, index) => {
    const heading = beat.replace(/^[0-9]+[.)]\s*/, "").trim() || `Teaching point ${index + 1}`;
    return `## ${heading}

${expandBeat(heading, plan.summary, plan.learningObjectives, index)}`;
  });

  const takeaways = (plan.learningObjectives.length ? plan.learningObjectives : beats.slice(0, 4)).map(
    (item) => `• ${item.replace(/^[0-9]+[.)]\s*/, "").trim()}`,
  );

  return [
    plan.summary.trim(),
    sections.join("\n\n"),
    takeaways.length ? `Key takeaways:\n${takeaways.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function expandBeat(heading: string, summary: string, objectives: string[], index: number) {
  const related = objectives[index] || objectives[0] || heading;
  const context = summary.trim() || heading;
  return [
    `${heading.replace(/\.$/, "")} ${SYNTHETIC_LESSON_MARKER}. ${context} That is the situation the learner has to handle.`,
    `Start from the mechanism: what inputs exist, what the system actually does with them, and what a wrong choice costs. ${related.replace(/\.$/, "")}. Write the check the practitioner runs before they ship.`,
    `A common mistake is treating the heading as finished work — naming ${heading.toLowerCase()} without proving it in the running system. Use a concrete walk-through: one request, one record, one failure, and the repair.`,
    `Practice: apply this beat to the same production path described in the lesson summary. If the result cannot be demonstrated, the explanation is still incomplete.`,
  ].join(" ");
}

export function isSyntheticLessonBody(body: string) {
  return body.includes(SYNTHETIC_LESSON_MARKER);
}
