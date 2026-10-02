import type { PersistedProgramDraft } from "../catalogPersistence";
import { wantsAdd, wantsRemove, wantsRename } from "./fuzzy";

// Guards against silently guessing when the instructor names an outline
// position that doesn't exist. An explicit "module 9" or "lesson 2.9" that has
// no match should produce a specific question, not a fallback to whatever
// module happens to be selected. Adding past the end of an existing module is
// allowed (it appends) — only a missing MODULE, or a missing lesson for a
// non-additive action (remove/rename/edit), is treated as unresolvable.

export type ReferenceIssue = { message: string };

function moduleCountPhrase(count: number): string {
  return `${count} module${count === 1 ? "" : "s"}`;
}

function lessonCountPhrase(count: number): string {
  return `${count} lesson${count === 1 ? "" : "s"}`;
}

export function findReferenceIssue(
  instruction: string,
  draft: PersistedProgramDraft,
): ReferenceIssue | null {
  const text = instruction.trim();
  if (!text) return null;

  const moduleCount = draft.modules.length;
  const isAdditive = wantsAdd(text) && !wantsRemove(text) && !wantsRename(text);

  for (const match of text.matchAll(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/g)) {
    const moduleNum = Number(match[1]);
    const lessonNum = Number(match[2]);
    const module = draft.modules[moduleNum - 1];

    if (!module) {
      return {
        message: `I don't see a module ${moduleNum} — this course has ${moduleCountPhrase(moduleCount)}. Which module should I use?`,
      };
    }

    // A missing lesson only blocks non-additive actions; "add lesson 2.9" just
    // appends to module 2, so it isn't an error.
    if (!module.lessons[lessonNum - 1] && !isAdditive) {
      return {
        message: `I don't see lesson ${moduleNum}.${lessonNum} — “${module.title}” has ${lessonCountPhrase(module.lessons.length)}. Which lesson do you mean?`,
      };
    }
  }

  for (const match of text.matchAll(/\bmodules?\s+(\d{1,2})\b/gi)) {
    const moduleNum = Number(match[1]);
    if (!draft.modules[moduleNum - 1]) {
      return {
        message: `I don't see a module ${moduleNum} — this course has ${moduleCountPhrase(moduleCount)}. Which module should I use?`,
      };
    }
  }

  return null;
}
