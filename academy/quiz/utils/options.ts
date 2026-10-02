import { isAcademyQuestionType, type AcademyQuestionType, type LearnerQuizOption } from "../types";

const TRUE_FALSE_OPTIONS: LearnerQuizOption[] = [
  { id: "true", label: "True" },
  { id: "false", label: "False" },
];

function optionFromUnknown(value: unknown, index: number): LearnerQuizOption | null {
  if (typeof value === "string") {
    const label = value.trim();
    if (!label) return null;
    return { id: label, label };
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const label = String(value);
    return { id: label, label };
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const idSource = record.id ?? record.value ?? record.label;
  const labelSource = record.label ?? record.text ?? record.value ?? record.id;
  if (idSource == null || labelSource == null) return null;
  const id = String(idSource).trim();
  const label = String(labelSource).trim();
  if (!id || !label) return null;
  return { id, label: label || `Option ${index + 1}` };
}

export function normalizeQuizOptions(
  type: AcademyQuestionType,
  options: unknown,
): LearnerQuizOption[] {
  // Authoring meta: { choices: string[], fromBank?: boolean }
  if (options && typeof options === "object" && !Array.isArray(options)) {
    const record = options as Record<string, unknown>;
    if (Array.isArray(record.choices)) {
      return normalizeQuizOptions(type, record.choices);
    }
  }

  if (Array.isArray(options)) {
    const parsed = options
      .map((item, index) => optionFromUnknown(item, index))
      .filter((item): item is LearnerQuizOption => item !== null);
    if (type === "true_false") {
      return parsed.length >= 2 ? parsed.slice(0, 2) : TRUE_FALSE_OPTIONS;
    }
    return parsed;
  }

  if (options && typeof options === "object") {
    const parsed = Object.entries(options as Record<string, unknown>)
      .map(([id, label], index) => {
        const text = typeof label === "string" ? label.trim() : String(label ?? "").trim();
        const key = id.trim();
        if (!key || !text) return optionFromUnknown({ id: key, label: text }, index);
        return { id: key, label: text };
      })
      .filter((item): item is LearnerQuizOption => item !== null);
    if (type === "true_false") {
      return parsed.length >= 2 ? parsed.slice(0, 2) : TRUE_FALSE_OPTIONS;
    }
    return parsed;
  }

  return type === "true_false" ? TRUE_FALSE_OPTIONS : [];
}

export function parseQuestionType(value: unknown): AcademyQuestionType | null {
  return typeof value === "string" && isAcademyQuestionType(value) ? value : null;
}
