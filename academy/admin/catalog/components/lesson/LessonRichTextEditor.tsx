"use client";

/** Back-compat shim — use LessonBlockEditor. */
export { LessonBlockEditor as LessonRichTextEditor, LessonBlockEditor } from "./LessonBlockEditor";
export {
  parseLessonToBlocks,
  blocksToLessonMarkdown,
  type LessonEditBlock,
} from "./LessonBlockEditor";
