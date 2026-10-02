import "server-only";

import type { WhitbyRefineContext } from "../../actions";
import { generateJson } from "../catalogPipeline/deepseek";
import type { PersistedLesson, PersistedProgramDraft } from "../catalogPersistence";
import {
  AFTER_LESSON_RE,
  BEFORE_LESSON_RE,
  CO_AUTHOR_SYSTEM,
  INSIDE_LESSON_RE,
  wantsRemoveAssignment,
} from "./coAuthorSystem";
import { conversationPromptBlock } from "./conversationHistory";
import {
  beautifyEditNotes,
  detectContentKind,
  deepenLessonNotes,
  formatEditNotes,
  headingRenameNotes,
  isBeautifyRequest,
  isConversationalAsk,
  isDepthTopic,
  isFormatRequest,
  isHeadingRenameRequest,
  isQualityQuestion,
  isWholeCourseDepthAsk,
  looksLikeMutation,
  mentionsLesson as fuzzyMentionsLesson,
  mentionsModule as fuzzyMentionsModule,
  wantsAdd as fuzzyWantsAdd,
  wantsDeeperContent,
  wantsEdit as fuzzyWantsEdit,
  wantsProgramOverview,
  wantsRemove as fuzzyWantsRemove,
  wantsRename as fuzzyWantsRename,
  wantsUndoChanges,
} from "./fuzzy";
import { parseOrdinalModuleIndex, parseOutlineHint, parseOutlineTarget } from "./locator";
import {
  contextForUnderstood,
  understandInstruction,
  type UnderstoodIntent,
} from "./understand";
import { thinkWhitbyMessage } from "./think";
import {
  clampCount,
  KNOWN_WHITBY_INTENTS,
  outlineDraft,
  type WhitbyIntent,
  type WhitbyPlan,
} from "./types";

const COUNT_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
};

function extractCount(text: string, moreFallback: number): number {
  const dotted = text.match(/\b\d{1,2}\.\d{1,2}\b/);
  const searchable = dotted ? text.replace(dotted[0], " ") : text;
  const digit = searchable.match(/\b(\d{1,2})\b/);
  if (digit) return clampCount(Number(digit[1]));
  for (const [word, value] of Object.entries(COUNT_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(text)) return clampCount(value);
  }
  if (/\bmore\b|\banother\b|\bextra\b|\badditional\b/i.test(text)) return moreFallback;
  return 1;
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match?.[0]?.replace(/[.,;]+$/, "") ?? null;
}

function kindToLessonType(kind: ReturnType<typeof detectContentKind>): PersistedLesson["type"] | undefined {
  if (kind === "scenario" || kind === "quiz" || kind === "video" || kind === "assignment" || kind === "reading" || kind === "resource") {
    return kind;
  }
  return undefined;
}

function firstContentLesson(
  draft: PersistedProgramDraft,
): { moduleIndex: number; lessonIndex: number } | null {
  for (let moduleIndex = 0; moduleIndex < draft.modules.length; moduleIndex += 1) {
    const module = draft.modules[moduleIndex];
    const lessonIndex = module.lessons.findIndex(
      (lesson) => lesson.type === "reading" || lesson.type === "scenario" || lesson.type === "resource",
    );
    if (lessonIndex >= 0) return { moduleIndex, lessonIndex };
  }
  for (let moduleIndex = 0; moduleIndex < draft.modules.length; moduleIndex += 1) {
    if (draft.modules[moduleIndex].lessons.length) return { moduleIndex, lessonIndex: 0 };
  }
  return null;
}

function preferredModuleIndex(
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): number | null {
  if (context?.moduleIndex != null && draft.modules[context.moduleIndex]) {
    return context.moduleIndex;
  }
  const contentIndex = draft.modules.findIndex(
    (module) => !/final\s+assessment/i.test(module.title.trim()),
  );
  if (contentIndex >= 0) return contentIndex;
  return draft.modules.length ? draft.modules.length - 1 : null;
}

function planFor(
  intents: WhitbyIntent[],
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
  extra?: Partial<WhitbyPlan>,
): WhitbyPlan {
  const target = parseOutlineTarget(instruction, draft, context);
  // A tolerant read of any explicit module/lesson number the user wrote, so an
  // explicit "module 2" is honored even when the exact lesson slot is new.
  const hint = parseOutlineHint(instruction, draft);
  const moduleIndex =
    extra?.moduleIndex ??
    target?.moduleIndex ??
    hint?.moduleIndex ??
    preferredModuleIndex(draft, context);
  const additive = intents.some((intent) => intent.startsWith("add") || intent === "expand_quiz");

  let lessonIndex =
    extra?.lessonIndex !== undefined
      ? extra.lessonIndex
      : target?.lessonIndex ?? null;

  // "add lesson 2.5" where module 2 has fewer than 5 lessons: honor the module
  // and place the new lesson at the requested position (insert after 2.4, or
  // append when the number is past the end) instead of dropping the reference.
  if (
    additive &&
    lessonIndex == null &&
    hint?.lessonNumber != null &&
    hint.moduleIndex === moduleIndex &&
    moduleIndex != null
  ) {
    const module = draft.modules[moduleIndex];
    if (module) {
      const desiredPos = hint.lessonNumber - 1; // 0-based slot the new lesson should occupy
      lessonIndex = desiredPos >= module.lessons.length ? null : Math.max(0, desiredPos - 1);
    }
  }
  const fallback = intents.includes("expand_quiz") ? 4 : intents.includes("add_quiz") ? 2 : 2;
  const kind = extra?.lessonType ?? kindToLessonType(detectContentKind(instruction));

  return {
    intents,
    count: extra?.count ?? clampCount(extractCount(instruction, additive ? fallback : 1)),
    moduleIndex,
    lessonIndex,
    notes: extra?.notes ?? instruction,
    videoUrl: extra?.videoUrl ?? extractUrl(instruction),
    lessonType: kind,
    mode: extra?.mode,
  };
}

export function routeWhitbyInstruction(
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): WhitbyPlan | null {
  const text = instruction.trim();
  if (!text) return null;

  const focusedLesson =
    context?.moduleIndex != null && context.lessonIndex != null
      ? draft.modules[context.moduleIndex]?.lessons[context.lessonIndex]
      : null;

  // Program / course name & overview win over lesson focus, "more", and remove.
  // Fixes: "change the program name…", "course name not lesson", etc.
  if (wantsProgramOverview(text)) {
    return planFor(["edit_overview"], text, draft, context);
  }

  // "remove changes" / undo — never treat as delete lesson.
  if (wantsUndoChanges(text)) {
    return planFor(
      ["answer"],
      "The instructor wants to undo or discard recent Whitby changes, not delete a lesson. Tell them to use the Undo button above the chat, then confirm what they want next (e.g. a better course title).",
      draft,
      context,
      { notes: text },
    );
  }

  // Questions about depth get an answer. Commands to deepen get a rewrite.
  if (isQualityQuestion(text) || (isDepthTopic(text) && !wantsDeeperContent(text))) {
    return planFor(["answer"], text, draft, context, { notes: text });
  }

  // “what you do?” / capability asks — chat only, never invent an edit.
  if (isConversationalAsk(text)) {
    return planFor(["answer"], text, draft, context, { notes: text });
  }

  // “make this beautiful / definition cards” — polish layout of the named/selected lesson.
  if (isBeautifyRequest(text)) {
    const beautifyTarget = parseOutlineTarget(text, draft, context);
    const selected =
      context?.focus === "lesson" && context.moduleIndex != null && context.lessonIndex != null
        ? { moduleIndex: context.moduleIndex, lessonIndex: context.lessonIndex }
        : null;
    const loc =
      beautifyTarget?.lessonIndex != null
        ? { moduleIndex: beautifyTarget.moduleIndex, lessonIndex: beautifyTarget.lessonIndex }
        : selected;
    if (!loc) {
      return planFor(
        ["answer"],
        "Which lesson should I beautify? Select it or name it (e.g. 1.1), then say “make definitions cards” or “make this look professional”.",
        draft,
        context,
        { notes: text },
      );
    }
    return planFor(["edit_lesson"], text, draft, context, {
      moduleIndex: loc.moduleIndex,
      lessonIndex: loc.lessonIndex,
      notes: beautifyEditNotes(text),
    });
  }

  // “make Key takeaways bold” — format the named lesson, do not add lessons.
  if (isFormatRequest(text)) {
    const formatTarget = parseOutlineTarget(text, draft, context);
    const selected =
      context?.focus === "lesson" && context.moduleIndex != null && context.lessonIndex != null
        ? { moduleIndex: context.moduleIndex, lessonIndex: context.lessonIndex }
        : null;
    const loc =
      formatTarget?.lessonIndex != null
        ? { moduleIndex: formatTarget.moduleIndex, lessonIndex: formatTarget.lessonIndex }
        : selected;
    if (!loc) {
      return planFor(
        ["answer"],
        "Which lesson should I format? Name it (e.g. module 1 lesson 1 / 1.1) or select it, then say what to bold or italicize.",
        draft,
        context,
        { notes: text },
      );
    }
    return planFor(["edit_lesson"], text, draft, context, {
      moduleIndex: loc.moduleIndex,
      lessonIndex: loc.lessonIndex,
      notes: formatEditNotes(text),
    });
  }

  // “heading change name” / rename a heading inside a lesson — edit that lesson only.
  if (isHeadingRenameRequest(text)) {
    const renameTarget = parseOutlineTarget(text, draft, context);
    const selected =
      context?.focus === "lesson" && context.moduleIndex != null && context.lessonIndex != null
        ? { moduleIndex: context.moduleIndex, lessonIndex: context.lessonIndex }
        : null;
    const loc =
      renameTarget?.lessonIndex != null
        ? { moduleIndex: renameTarget.moduleIndex, lessonIndex: renameTarget.lessonIndex }
        : selected;
    if (!loc) {
      return planFor(
        ["answer"],
        "Which lesson’s heading should I rename? Name it (e.g. module 1 lesson 1) and the new heading text.",
        draft,
        context,
        { notes: text },
      );
    }
    return planFor(["edit_lesson"], text, draft, context, {
      moduleIndex: loc.moduleIndex,
      lessonIndex: loc.lessonIndex,
      notes: headingRenameNotes(text),
    });
  }

  if (wantsDeeperContent(text)) {
    const depthTarget = parseOutlineTarget(text, draft, context);
    const selected =
      context?.focus === "lesson" && context.moduleIndex != null && context.lessonIndex != null
        ? { moduleIndex: context.moduleIndex, lessonIndex: context.lessonIndex }
        : null;
    const named =
      depthTarget?.lessonIndex != null
        ? { moduleIndex: depthTarget.moduleIndex, lessonIndex: depthTarget.lessonIndex }
        : null;
    const firstContent = firstContentLesson(draft);
    const loc = named ?? selected ?? (isWholeCourseDepthAsk(text) ? firstContent : selected ?? firstContent);
    if (!loc) {
      return planFor(
        ["answer"],
        "The draft is too thin. Select the lesson to deepen and say “make this more in-depth”, or name it (e.g. “deepen 1.2”). I won’t rename the course.",
        draft,
        context,
        { notes: text },
      );
    }
    return planFor(["edit_lesson"], text, draft, context, {
      moduleIndex: loc.moduleIndex,
      lessonIndex: loc.lessonIndex,
      notes: deepenLessonNotes(text),
    });
  }

  const wantsAdd = fuzzyWantsAdd(text) || /\bnew\b|\banother\b/i.test(text);
  // "more" alone often means "better/more polished" (e.g. "more best heading"),
  // not "add more lessons". Only treat "more" as additive with a content noun.
  const wantsMore =
    /\b(another|extra|additional)\b/i.test(text) ||
    /\bmore\s+(lessons?|modules?|quizzes?|questions?|videos?|assignments?|scenarios?|content|examples?)\b/i.test(
      text,
    ) ||
    /\b(add|create|insert|include)\b[\s\S]{0,20}\bmore\b/i.test(text);
  const wantsRemove = fuzzyWantsRemove(text);
  const wantsRename = fuzzyWantsRename(text);
  const kind = detectContentKind(text);
  const mentionsQuiz = kind === "quiz";
  const mentionsAssignment = kind === "assignment";
  const mentionsVideo = kind === "video";
  const mentionsLesson = fuzzyMentionsLesson(text);
  const mentionsModule = fuzzyMentionsModule(text) || kind === "module";
  const mentionsOverview = /\btitle\b|\bdescription\b|\boverview\b|\bheading\b/i.test(text);
  const wantsRewrite = /\b(rebuild|restructure|reshape|start over|rewrite (the )?(whole |entire )?program|rewrite (the )?course)\b/i.test(
    text,
  );
  const wantsEdit = fuzzyWantsEdit(text);
  const questionsOnly = /\bquestions?\b/i.test(text) && !/\bquiz(zes)?\b/i.test(text);
  const looksLikeQuestion =
    /\?$/.test(text) ||
    /^(what|who|why|how|which|where|when|can you|could you|please explain|tell me|list|show me)\b/i.test(
      text,
    );
  const target = parseOutlineTarget(text, draft, context);
  const hasTarget = target?.lessonIndex != null || target?.moduleIndex != null;
  const namedLesson = target?.lessonIndex != null;
  const saidThis = /\b(this|the selected|current)\b/i.test(text);
  const focusedNamed =
    namedLesson ||
    (context?.focus === "lesson" && context.lessonIndex != null && saidThis);
  // Only treat the open lesson as the target when the instructor pointed at it.
  // Bare verbs like "change" / "update" must NOT steal focus from program/module asks.
  const refersToSelection =
    context?.focus === "lesson" &&
    context.lessonIndex != null &&
    (saidThis ||
      (/\b(improve|rewrite|fix|polish|tighten|expand|shorten|longer|shorter|deepen|elaborate)\b/i.test(text) &&
        !mentionsModule &&
        !wantsProgramOverview(text) &&
        !/\b(program|course|module)\b/i.test(text)) ||
      (/\bmake (it|this)\b/i.test(text) &&
        /\b(short|shorter|longer|clearer|better|simpler|deeper|detailed|thorough|in[- ]?depth)\b/i.test(text) &&
        !/\b(program|course|module)\b/i.test(text)));
  const wantsStandaloneLesson = /\b(new lesson|another lesson|separate lesson|scenario lesson|assignment lesson)\b/i.test(text);
  const wantsInsideLesson =
    focusedNamed &&
    !wantsStandaloneLesson &&
    !AFTER_LESSON_RE.test(text) &&
    !BEFORE_LESSON_RE.test(text) &&
    (INSIDE_LESSON_RE.test(text) ||
      /\bsection\b/i.test(text) ||
      /\bnot (a |my )?(new |separate )?lesson\b/i.test(text) ||
      /\bnot (before|after)\b/i.test(text) ||
      /\bnot my point\b/i.test(text));
  const wantsInsertAfter = AFTER_LESSON_RE.test(text) && !/\bnot after\b/i.test(text);
  const wantsInsertBefore = BEFORE_LESSON_RE.test(text) && !/\bnot before\b/i.test(text);

  if (wantsRewrite) {
    return planFor(["rewrite_program"], text, draft, context);
  }

  // Content removal must win over lesson deletion: "remove the assignment from 1.3".
  if (wantsRemove && wantsRemoveAssignment(text)) {
    return planFor(["remove_assignment"], text, draft, context);
  }

  if (wantsRemove && mentionsModule && !mentionsLesson) {
    return planFor(["remove_module"], text, draft, context);
  }
  // "not lesson" / course-name corrections must never become remove_lesson.
  if (
    wantsRemove &&
    (mentionsLesson || target?.lessonIndex != null) &&
    !/\bnot\s+(a\s+|the\s+|my\s+)?lesson\b/i.test(text) &&
    !/\b(course|program)\s+(name|title|heading)\b/i.test(text)
  ) {
    return planFor(["remove_lesson"], text, draft, context);
  }
  if (wantsRemove && mentionsModule) {
    return planFor(["remove_module"], text, draft, context);
  }

  if (wantsRename && !wantsAdd) {
    // Rename of the program/course title is overview — not a lesson rename.
    if (/\b(program|course)\b/i.test(text) || (!mentionsLesson && !mentionsModule && context?.focus !== "lesson")) {
      return planFor(["edit_overview"], text, draft, context);
    }
    return planFor(["rename_item"], text, draft, context);
  }

  const intents: WhitbyIntent[] = [];
  const adding = wantsAdd || wantsMore || Boolean(kind && hasTarget && !wantsEdit && !wantsRemove);

  // "add more content / examples / detail IN lesson 1.5" means expand that
  // lesson's body — not create new lessons. Distinguish it from "add 2 lessons"
  // by requiring body-content words and rejecting an explicit lesson-count
  // object (the dotted lesson reference is stripped first so "1.5 lesson" is
  // read as a location, not a "5 lesson" quantity).
  const wantsBodyContent =
    /\b(content|example|examples|detail|details|elaborat\w*|explanation|explanations|depth|paragraph|paragraphs|material|info|information)\b/i.test(
      text,
    );
  const withoutDottedRefs = text.replace(/\b\d{1,2}\.\d{1,2}\b/g, " ");
  const addsLessonItems =
    /\b(a|an|another|two|three|four|five|\d{1,2}|some|few|new|more)\s+(new\s+)?lessons?\b/i.test(
      withoutDottedRefs,
    );
  const editableLessonTarget =
    namedLesson || (context?.focus === "lesson" && context.lessonIndex != null);

  // "add a lesson in the second module" / "add lesson to module 2": the lesson
  // is the object and the module is only a location, so this must add a lesson
  // (into that module), never create a module.
  const wantsLessonInModule =
    mentionsLesson &&
    (/\b(in|into|inside|within|to)\b[^.]*\bmodules?\b/i.test(text) ||
      /\bmodules?\s+\d{1,2}\b/i.test(text) ||
      parseOrdinalModuleIndex(text, draft) != null);

  if (
    adding &&
    wantsBodyContent &&
    !addsLessonItems &&
    editableLessonTarget &&
    !wantsStandaloneLesson &&
    !mentionsQuiz &&
    !mentionsAssignment &&
    !mentionsVideo &&
    kind !== "module" &&
    kind !== "scenario"
  ) {
    return planFor(["edit_lesson"], text, draft, context);
  }

  if (adding && mentionsQuiz) {
    if (
      (questionsOnly || wantsMore) &&
      (focusedLesson?.type === "quiz" || focusedLesson?.quiz || focusedNamed)
    ) {
      // "add questions" / "add more questions" on a selected quiz → expand that quiz.
      // If they selected a quiz lesson without saying "questions", still prefer expand when wantsMore.
      if (focusedLesson?.type === "quiz" || focusedLesson?.quiz || questionsOnly) {
        intents.push("expand_quiz");
      } else {
        intents.push("add_quiz");
      }
    } else if (focusedLesson?.type === "quiz" || focusedLesson?.quiz) {
      intents.push(questionsOnly || wantsMore ? "expand_quiz" : "add_quiz");
    } else {
      intents.push("add_quiz");
    }
  } else if (adding && mentionsAssignment) {
    intents.push("add_assignment");
  } else if (adding && mentionsVideo) {
    intents.push("add_video");
  } else if (adding && kind === "scenario") {
    if (wantsInsideLesson || (namedLesson && !wantsStandaloneLesson) || refersToSelection) {
      intents.push("embed_content");
    } else {
      intents.push("add_lessons");
    }
  } else if (adding && kind === "resource") {
    intents.push("add_lessons");
  } else if (adding && mentionsModule && kind === "module" && !addsLessonItems && !wantsLessonInModule) {
    intents.push("add_module");
  } else if (
    adding &&
    (mentionsLesson || kind === "reading" || addsLessonItems || wantsLessonInModule)
  ) {
    intents.push("add_lessons");
  }

  // "improve this" / "rewrite this" with a lesson selected → edit that lesson.
  if (intents.length === 0 && refersToSelection && (context?.focus === "lesson" || target?.lessonIndex != null)) {
    intents.push("edit_lesson");
  }
  if (intents.length === 0 && wantsEdit && target?.lessonIndex != null) {
    intents.push("edit_lesson");
  }
  if (intents.length === 0 && mentionsOverview && !wantsAdd && !wantsRename) {
    intents.push("edit_overview");
  }
  // Do NOT auto-edit the open lesson on a bare "change/update" — that caused
  // course-name and other non-lesson requests to mutate the wrong thing.

  if (intents.length > 0) {
    const attachAssignment =
      intents.includes("add_assignment") &&
      (namedLesson || (context?.focus === "lesson" && context.lessonIndex != null)) &&
      !wantsInsertAfter &&
      !wantsInsertBefore &&
      !wantsStandaloneLesson &&
      (wantsInsideLesson ||
        refersToSelection ||
        focusedNamed ||
        /\brelated to\b/i.test(text) ||
        /\bas part of\b/i.test(text) ||
        /\battach(ed)? to\b/i.test(text) ||
        /\b(in|inside|under)\b.{0,32}\d{1,2}\.\d{1,2}\b/i.test(text) ||
        /\bnot (before|after)\b/i.test(text) ||
        // Default: selected lesson + "add assignment" → attach inside, not a new lesson.
        (context?.focus === "lesson" && context.lessonIndex != null && !wantsStandaloneLesson));

    return planFor(intents, text, draft, context, {
      lessonType: kindToLessonType(kind) ?? (intents.includes("add_lessons") ? "reading" : undefined),
      mode: intents.includes("add_assignment") ? (attachAssignment ? "attach" : "insert") : undefined,
      // Prefer selected lesson indices for expand/attach when user said "this".
      ...(intents.includes("expand_quiz") || attachAssignment
        ? {
            moduleIndex: context?.moduleIndex ?? undefined,
            lessonIndex: context?.lessonIndex ?? undefined,
          }
        : null),
    });
  }

  if (looksLikeQuestion && !looksLikeMutation(text)) {
    return planFor(["answer"], text, draft, context);
  }

  if (!looksLikeMutation(text)) {
    return planFor(["answer"], text, draft, context);
  }

  return null;
}

export async function routeWhitbyInstructionWithModel(
  instruction: string,
  draft: PersistedProgramDraft,
  context?: WhitbyRefineContext,
): Promise<WhitbyPlan> {
  const understood: UnderstoodIntent = understandInstruction(instruction, draft, context);
  const scopedContext = contextForUnderstood(context, understood);
  const text = understood.normalized.trim() || instruction.trim();

  console.info(
    `[whitby-understand] scope=${understood.scope} conf=${understood.confidence} followUp=${understood.isFollowUp} correction=${understood.isCorrection} clarify=${Boolean(understood.clarify)} raw="${instruction.slice(0, 60)}"`,
  );

  // Local ambiguity (e.g. which quiz?) — ask before DeepSeek invents a target.
  if (understood.clarify) {
    return planFor(["answer"], understood.clarify, draft, scopedContext, {
      notes: understood.clarify,
    });
  }

  if (understood.isUndo || wantsUndoChanges(text) || wantsUndoChanges(instruction)) {
    return planFor(
      ["answer"],
      "The instructor wants to undo or discard recent Whitby changes, not delete a lesson. Tell them to use the Undo button above the chat, then confirm what they want next.",
      draft,
      scopedContext,
      { notes: text },
    );
  }

  // Primary brain: DeepSeek reads every message, rewrites intent, then
  // answer | clarify | act. Heuristics only validate / fall back.
  const thought = await thinkWhitbyMessage(text || instruction, draft, scopedContext);
  if (thought) {
    console.info(
      `[whitby-think] mode=${thought.mode} conf=${thought.confidence} phrase="${thought.intentPhrase}" intents=${thought.intents.join(",") || "—"} plain="${thought.plainIntent.slice(0, 80)}"`,
    );

    if (thought.mode === "clarify" || thought.mode === "answer") {
      return planFor(["answer"], thought.replyNotes, draft, scopedContext, {
        notes: thought.replyNotes,
      });
    }

    if (thought.mode === "act" && thought.intents.length > 0) {
      // Safety: never mutate on a pure meta/quality question.
      if (
        (isConversationalAsk(text) ||
          isConversationalAsk(instruction) ||
          isQualityQuestion(text) ||
          isQualityQuestion(instruction)) &&
        !isBeautifyRequest(text) &&
        !isBeautifyRequest(instruction) &&
        !isFormatRequest(text) &&
        !isFormatRequest(instruction) &&
        !isHeadingRenameRequest(text) &&
        !isHeadingRenameRequest(instruction)
      ) {
        return planFor(["answer"], text || instruction, draft, scopedContext, {
          notes: text || instruction,
        });
      }

      const notes =
        isBeautifyRequest(text) || isBeautifyRequest(instruction)
          ? beautifyEditNotes(text || instruction)
          : isFormatRequest(text) || isFormatRequest(instruction)
            ? formatEditNotes(text || instruction)
            : isHeadingRenameRequest(text) || isHeadingRenameRequest(instruction)
              ? headingRenameNotes(text || instruction)
              : thought.replyNotes || thought.plainIntent || text;

      return planFor(thought.intents, thought.plainIntent || text, draft, scopedContext, {
        count: clampCount(thought.count || (thought.intents.includes("expand_quiz") ? 4 : 2)),
        notes,
        lessonType: thought.lessonType,
        mode: thought.intents.includes("add_assignment")
          ? thought.assignmentMode ?? "insert"
          : undefined,
      });
    }
  }

  // --- Heuristic fallback (model unavailable or empty act) ---

  if (wantsDeeperContent(text) || wantsDeeperContent(instruction)) {
    const deepened =
      routeWhitbyInstruction(instruction, draft, context) ??
      routeWhitbyInstruction(text, draft, scopedContext);
    if (deepened) return deepened;
  }

  if (isQualityQuestion(text) || isQualityQuestion(instruction) || isDepthTopic(text)) {
    const answered =
      routeWhitbyInstruction(instruction, draft, context) ??
      routeWhitbyInstruction(text, draft, scopedContext);
    if (answered) return answered;
  }

  if (isConversationalAsk(text) || isConversationalAsk(instruction)) {
    return planFor(["answer"], text || instruction, draft, scopedContext, {
      notes: text || instruction,
    });
  }

  if (isBeautifyRequest(text) || isBeautifyRequest(instruction)) {
    const beautified =
      routeWhitbyInstruction(instruction, draft, context) ??
      routeWhitbyInstruction(text, draft, scopedContext);
    if (beautified) return beautified;
  }

  if (isFormatRequest(text) || isFormatRequest(instruction)) {
    const formatted =
      routeWhitbyInstruction(instruction, draft, context) ??
      routeWhitbyInstruction(text, draft, scopedContext);
    if (formatted) return formatted;
  }

  if (isHeadingRenameRequest(text) || isHeadingRenameRequest(instruction)) {
    const renamed =
      routeWhitbyInstruction(instruction, draft, context) ??
      routeWhitbyInstruction(text, draft, scopedContext);
    if (renamed) return renamed;
  }

  if ((understood.hints.preferOverview || wantsProgramOverview(text)) && !wantsDeeperContent(text)) {
    return planFor(["edit_overview"], text, draft, scopedContext);
  }

  const determined = routeWhitbyInstruction(text, draft, scopedContext);
  if (determined) return determined;

  const fallback = planFor(["answer"], text, draft, scopedContext);
  if (!looksLikeMutation(text)) return fallback;

  try {
    const conversation = conversationPromptBlock(context?.recentChat, { windowSize: 12 });
    const response = await generateJson<{
      intents?: WhitbyIntent[];
      count?: number;
      notes?: string;
      lessonType?: PersistedLesson["type"];
      mode?: "attach" | "insert" | null;
      intentPhrase?: string;
      clarify?: string | null;
      scope?: "program" | "module" | "lesson" | "content" | "chat";
    }>(
      `You are Whitby's intent router for an LMS course builder. Be smart on EVERY message — typos, slang, corrections, and follow-ups.

${CO_AUTHOR_SYSTEM}

First decide:
1) intentPhrase — what they want in ≤8 words
2) scope — program | module | lesson | content | chat
3) clarify — ONE question if ambiguous, else null
Then map to intents. If this is a question or meta ask, set clarify or leave intents empty.

Return JSON only:
{ "intentPhrase": "short", "scope": "program"|"module"|"lesson"|"content"|"chat", "clarify": string|null, "intents": ["add_lessons"|"add_module"|"add_quiz"|"expand_quiz"|"add_assignment"|"add_video"|"embed_content"|"edit_lesson"|"edit_overview"|"remove_lesson"|"remove_module"|"remove_assignment"|"rename_item"], "count": number, "notes": "short", "lessonType": "reading"|"scenario"|"video"|"quiz"|"assignment"|"resource", "mode": "attach"|"insert"|null }

Universal rules:
- Read recent conversation. Resolve “yes / do it / that one / not that” against the prior ask.
- Prefer additive intents (add_*) when they want a new outline item.
- Questions and “what you do?” → empty intents + clarify/answer notes. NEVER mutate.
- Format-only (bold/italic) → edit_lesson only.
- “deepen 1.1” → edit_lesson.
- Program/course name → edit_overview.
- Never use rewrite_program or answer in intents.`,
      `Latest instruction (highest priority): ${text}
Original message: ${instruction}
Understood scope hint: ${understood.scope}
${conversation ? `\n${conversation}\n` : ""}
Open focus: ${JSON.stringify({
        focus: scopedContext?.focus ?? context?.focus ?? "program",
        moduleTitle: scopedContext?.moduleTitle ?? context?.moduleTitle ?? null,
        lessonTitle: scopedContext?.lessonTitle ?? null,
        lessonType: scopedContext?.lessonType ?? null,
        moduleIndex: scopedContext?.moduleIndex ?? fallback.moduleIndex,
        lessonIndex: scopedContext?.lessonIndex ?? fallback.lessonIndex,
        lessonFocusIgnored: Boolean(understood.hints.ignoreLessonFocus),
      })}

Outline:
${JSON.stringify(outlineDraft(draft))}`,
      {
        task: "route",
        temperature: 0.15,
        maxTokens: 320,
        timeoutMs: 8_000,
        stream: true,
        label: "whitby-route-fallback",
      },
    );

    if (response?.clarify?.trim()) {
      return planFor(["answer"], response.clarify.trim(), draft, scopedContext, {
        notes: response.clarify.trim(),
      });
    }

    if (response?.scope === "program" && !wantsDeeperContent(text)) {
      return planFor(["edit_overview"], text, draft, scopedContext);
    }

    const intents = (response?.intents ?? []).filter(
      (intent): intent is WhitbyIntent =>
        KNOWN_WHITBY_INTENTS.includes(intent) && intent !== "rewrite_program" && intent !== "answer",
    );

    if (intents.length === 0) {
      return fallback;
    }

    const named = parseOutlineTarget(text, draft, scopedContext);
    const modelMode = response?.mode === "attach" || response?.mode === "insert" ? response.mode : undefined;
    const attachAssignment =
      intents.includes("add_assignment") &&
      named?.lessonIndex != null &&
      !AFTER_LESSON_RE.test(text) &&
      !BEFORE_LESSON_RE.test(text) &&
      (modelMode === "attach" ||
        INSIDE_LESSON_RE.test(text) ||
        /\bnot (before|after)\b/i.test(text));

    return planFor(intents, text, draft, scopedContext, {
      count: clampCount(Number(response?.count) || (intents.includes("expand_quiz") ? 4 : 2)),
      notes: response?.notes?.trim() || text,
      lessonType: response?.lessonType ?? kindToLessonType(detectContentKind(text)),
      mode: intents.includes("add_assignment")
        ? modelMode === "insert"
          ? "insert"
          : attachAssignment || modelMode === "attach"
            ? "attach"
            : "insert"
        : undefined,
    });
  } catch {
    return fallback;
  }
}
