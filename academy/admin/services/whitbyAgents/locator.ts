import type { WhitbyRefineContext } from "../../actions";
import type { PersistedProgramDraft } from "../catalogPersistence";

export type OutlineTarget = {
  moduleIndex: number;
  lessonIndex: number | null;
};

function inRange(draft: PersistedProgramDraft, moduleIndex: number, lessonIndex: number | null) {
  const module = draft.modules[moduleIndex];
  if (!module) return null;
  if (lessonIndex == null) return { moduleIndex, lessonIndex: null };
  if (!module.lessons[lessonIndex]) return null;
  return { moduleIndex, lessonIndex };
}

export function parseOutlineTargets(
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): OutlineTarget[] {
  const text = instruction.trim();
  if (!text) return [];

  const seen = new Set<string>();
  const targets: OutlineTarget[] = [];

  function add(target: OutlineTarget | null) {
    if (!target) return;
    const key = `${target.moduleIndex}:${target.lessonIndex ?? "m"}`;
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  }

  const range = text.match(/\b(\d{1,2})\.(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\.(\d{1,2})\b/i);
  if (range) {
    const fromModule = Number(range[1]) - 1;
    const fromLesson = Number(range[2]) - 1;
    const toModule = Number(range[3]) - 1;
    const toLesson = Number(range[4]) - 1;
    if (fromModule === toModule && toLesson >= fromLesson) {
      for (let lessonIndex = fromLesson; lessonIndex <= toLesson; lessonIndex += 1) {
        add(inRange(draft, fromModule, lessonIndex));
      }
    }
  }

  for (const match of text.matchAll(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/g)) {
    add(inRange(draft, Number(match[1]) - 1, Number(match[2]) - 1));
  }

  if (targets.length > 0) return targets;

  const single = parseOutlineTarget(text, draft, context);
  return single ? [single] : [];
}

export function parseOutlineTarget(
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): OutlineTarget | null {
  const text = instruction.trim();
  if (!text) return null;

  const dotted = text.match(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/);
  if (dotted) {
    return inRange(draft, Number(dotted[1]) - 1, Number(dotted[2]) - 1);
  }

  const moduleLesson = text.match(/\bmodule\s+(\d{1,2})\b[^\d]{0,24}\blesson\s+(\d{1,2})\b/i);
  if (moduleLesson) {
    return inRange(draft, Number(moduleLesson[1]) - 1, Number(moduleLesson[2]) - 1);
  }

  const moduleOnly = text.match(/\bmodules?\s+(\d{1,2})\b/i);
  const lessonOnly = text.match(/\blessons?\s+(\d{1,2})\b/i);
  if (moduleOnly && lessonOnly) {
    return inRange(draft, Number(moduleOnly[1]) - 1, Number(lessonOnly[1]) - 1);
  }
  if (moduleOnly) {
    return inRange(draft, Number(moduleOnly[1]) - 1, null);
  }
  if (lessonOnly) {
    const moduleIndex =
      context?.moduleIndex != null && draft.modules[context.moduleIndex]
        ? context.moduleIndex
        : 0;
    return inRange(draft, moduleIndex, Number(lessonOnly[1]) - 1);
  }

  const lowered = text.toLowerCase();
  for (let moduleIndex = 0; moduleIndex < draft.modules.length; moduleIndex += 1) {
    const module = draft.modules[moduleIndex];
    for (let lessonIndex = 0; lessonIndex < module.lessons.length; lessonIndex += 1) {
      const title = module.lessons[lessonIndex].title.trim().toLowerCase();
      if (title.length >= 8 && lowered.includes(title)) {
        return { moduleIndex, lessonIndex };
      }
    }
  }

  return null;
}

export type OutlineHint = {
  moduleIndex: number;
  /** Existing lesson index if the referenced lesson exists, else null. */
  lessonIndex: number | null;
  /** The 1-based lesson number the user wrote (e.g. 5 for "2.5"), for placement. */
  lessonNumber: number | null;
};

/**
 * A tolerant version of parseOutlineTarget for placement decisions: it resolves
 * an explicitly-referenced module even when the lesson slot doesn't exist yet
 * (e.g. "add lesson 2.5" into a module that currently has four lessons). This
 * is what stops an explicit "module 2" reference from being discarded and the
 * lesson landing in whatever module happens to be selected.
 */
export function parseOutlineHint(
  instruction: string,
  draft: PersistedProgramDraft,
): OutlineHint | null {
  const text = instruction.trim();
  if (!text) return null;

  const dotted = text.match(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/);
  if (dotted) {
    const moduleIndex = Number(dotted[1]) - 1;
    const lessonNumber = Number(dotted[2]);
    const module = draft.modules[moduleIndex];
    if (module) {
      const rawLessonIndex = lessonNumber - 1;
      return {
        moduleIndex,
        lessonIndex: module.lessons[rawLessonIndex] ? rawLessonIndex : null,
        lessonNumber,
      };
    }
  }

  const moduleOnly = text.match(/\bmodules?\s+(\d{1,2})\b/i);
  if (moduleOnly) {
    const moduleIndex = Number(moduleOnly[1]) - 1;
    if (draft.modules[moduleIndex]) {
      return { moduleIndex, lessonIndex: null, lessonNumber: null };
    }
  }

  // Ordinal-word module references: "second module", "the last module".
  const ordinalModuleIndex = parseOrdinalModuleIndex(text, draft);
  if (ordinalModuleIndex != null && draft.modules[ordinalModuleIndex]) {
    return { moduleIndex: ordinalModuleIndex, lessonIndex: null, lessonNumber: null };
  }

  return null;
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};

const ORDINAL_PATTERN =
  "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last";

/** Resolves "second module" / "module three" / "last module" to a 0-based index. */
export function parseOrdinalModuleIndex(
  instruction: string,
  draft: PersistedProgramDraft,
): number | null {
  const text = instruction.trim();
  const match =
    text.match(new RegExp(`\\b(${ORDINAL_PATTERN})\\s+modules?\\b`, "i")) ??
    text.match(new RegExp(`\\bmodules?\\s+(${ORDINAL_PATTERN})\\b`, "i"));
  if (!match) return null;

  const word = match[1].toLowerCase();
  if (word === "last") return draft.modules.length - 1;
  const number = ORDINAL_WORDS[word];
  return number ? number - 1 : null;
}

export function lessonLabel(draft: PersistedProgramDraft, moduleIndex: number, lessonIndex: number) {
  const module = draft.modules[moduleIndex];
  const lesson = module?.lessons[lessonIndex];
  if (!module || !lesson) return `lesson ${moduleIndex + 1}.${lessonIndex + 1}`;
  return `${moduleIndex + 1}.${lessonIndex + 1} “${lesson.title}”`;
}

export function moduleLabel(draft: PersistedProgramDraft, moduleIndex: number) {
  const module = draft.modules[moduleIndex];
  if (!module) return `module ${moduleIndex + 1}`;
  return `module ${moduleIndex + 1} “${module.title}”`;
}

export function parseRenameTitle(instruction: string) {
  const quoted = instruction.match(/\bto\s+["“']([^"”']+)["”']/i);
  if (quoted?.[1]) return quoted[1].trim();
  const plain = instruction.match(/\bto\s+(.+)$/i);
  if (!plain?.[1]) return null;
  return plain[1].replace(/[.?!]+$/, "").trim() || null;
}
