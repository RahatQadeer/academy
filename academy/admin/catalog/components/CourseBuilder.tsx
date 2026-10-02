"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  deleteAdminCatalogProgramAction,
  fillMissingLessonBodiesAction,
  loadCatalogProgramAction,
  publishAdminCatalogProgramAction,
  applyUnpublishedDraftAction,
  discardUnpublishedDraftAction,
  refineCatalogProgramAction,
  saveAdminCatalogDraftAction,
  saveAdminCatalogCoverAction,
  unpublishAdminCatalogProgramAction,
  type SaveAdminCatalogDraftInput,
  type WhitbyRefineContext,
} from "@/academy/admin/actions";
import { CourseBuilderTopBar } from "./CourseBuilderTopBar";
import { ModuleTree, type BuilderNode } from "./ModuleTree";
import { LessonEditor } from "./LessonEditor";
import { OverviewPane } from "./OverviewPane";
import type { WhitbyMessage, WhitbyReply } from "./WhitbyChat";
import { ConfirmDialog } from "./ConfirmDialog";
import { Callout } from "@/base/components/Callout";
import {
  addLesson,
  addModule,
  deleteLesson,
  deleteLessonsByNumbers,
  deleteModule,
  moveLesson,
  moveModule,
  parseDottedLessonRefs,
} from "../lib/courseOps";
import {
  publishProgramAction,
  submitPublishRequestAction,
} from "@/academy/instructor/programs/actions";
import {
  catalogProgramCanBeDeleted,
  catalogProgramDeletionMessage,
  getCatalogProgramDeletionBlock,
} from "@/academy/admin/lib/programDeletion";
import type { CatalogProgramDetail } from "../types";
import { lessonNeedsTeachingBody } from "@/academy/admin/lib/courseAttachmentText";
import { ScrollPane } from "@/academy/components/ScrollPane";
import { cn } from "@/base/lib/cn";

const BUILDER_DOCKED_MQ = "(min-width: 1024px)";
const OUTLINE_DOCKED_MQ = "(min-width: 768px)";

const ProgramSettings = dynamic(
  () => import("./ProgramSettings").then((mod) => ({ default: mod.ProgramSettings })),
  { ssr: false },
);
const ProgramPreview = dynamic(
  () => import("./ProgramPreview").then((mod) => ({ default: mod.ProgramPreview })),
  { ssr: false },
);
const WhitbyChat = dynamic(
  () => import("./WhitbyChat").then((mod) => ({ default: mod.WhitbyChat })),
  { ssr: false },
);

type Tab = "build" | "preview" | "settings";

type ConfirmState =
  | { kind: "lesson"; moduleId: string; lessonId: string; title: string }
  | { kind: "module"; moduleId: string; title: string; lessonCount: number }
  | { kind: "program" }
  | { kind: "hide" }
  | { kind: "submit" }
  | { kind: "revert" };

function buildDraftPayload(program: CatalogProgramDetail): SaveAdminCatalogDraftInput {
  return {
    programId: program.id,
    name: program.name,
    description: program.description,
    category: program.category,
    type: program.type,
    access: program.access,
    recognition: program.recognition,
    learningPath: program.learningPath,
    credentialValidity: program.credentialValidity ?? "none",
    price: program.price,
    coverImageUrl: program.coverImageUrl,
    prerequisiteProgramId: program.prerequisiteProgramId ?? "",
    tagIds: program.tagIds ?? [],
    modules: program.modules.map((module) => ({
      id: module.id,
      title: module.title,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        contentUrl: lesson.contentUrl,
        contentBody: lesson.contentBody,
        contentSummary: lesson.contentSummary,
        learningObjectives: lesson.learningObjectives,
        videoUrl: lesson.videoUrl,
        videoDurationSeconds: lesson.videoDurationSeconds ?? 0,
        resources: lesson.resources.map((resource) => ({
          title: resource.title,
          resourceType: resource.resourceType,
          url: resource.url,
          notes: resource.notes,
        })),
        assignment: lesson.assignment
          ? {
              brief: lesson.assignment.brief,
              submissionInstructions: lesson.assignment.submissionInstructions,
              rubric: lesson.assignment.rubric,
              estimatedMinutes: lesson.assignment.estimatedMinutes,
            }
          : null,
        quiz: lesson.quiz
          ? {
              passingScore: lesson.quiz.passingScore,
              questions: lesson.quiz.questions.map((question) => ({
                questionText: question.questionText,
                type: question.type,
                options: question.options,
                correctAnswer: question.correctAnswer,
                fromBank: question.fromBank,
              })),
            }
          : null,
      })),
    })),
  };
}

function snapshotKey(program: CatalogProgramDetail) {
  return JSON.stringify(buildDraftPayload(program));
}

function buildWhitbyContext(
  selected: BuilderNode,
  program: CatalogProgramDetail,
  activeModule?: CatalogProgramDetail["modules"][number],
  activeLesson?: CatalogProgramDetail["modules"][number]["lessons"][number],
  recentChat?: { role: "user" | "whitby"; content: string }[],
): WhitbyRefineContext {
  if (selected.kind === "overview") {
    return { focus: "overview", recentChat };
  }
  if (selected.kind === "lesson" && activeModule && activeLesson) {
    return {
      focus: "lesson",
      moduleTitle: activeModule.title,
      lessonTitle: activeLesson.title,
      moduleIndex: program.modules.indexOf(activeModule),
      lessonIndex: activeModule.lessons.indexOf(activeLesson),
      lessonType: activeLesson.type,
      lessonSummary: activeLesson.contentSummary || undefined,
      lessonExcerpt: activeLesson.contentBody?.slice(0, 1500) || undefined,
      recentChat,
    };
  }
  return { focus: "program", recentChat };
}

function whitbyPlaceholder(
  selected: BuilderNode,
  activeLesson?: CatalogProgramDetail["modules"][number]["lessons"][number],
) {
  if (selected.kind === "lesson" && activeLesson) {
    if (activeLesson.type === "quiz" || activeLesson.quiz) {
      return `Add questions to “${activeLesson.title}”, or say “rename the course to …”`;
    }
    if (activeLesson.type === "assignment") {
      return `Rewrite “${activeLesson.title}”, or rename the course…`;
    }
    if (activeLesson.type === "video") {
      return `Edit “${activeLesson.title}”, or rename the course…`;
    }
    return `Edit “${activeLesson.title}”, beautify layout, or rename the course…`;
  }
  if (selected.kind === "overview") {
    return "Rename the course, improve the description, or add a lesson…";
  }
  return "Add a module, lesson, quiz — or rename the course…";
}

function whitbySuggestions(
  selected: BuilderNode,
  activeLesson?: CatalogProgramDetail["modules"][number]["lessons"][number],
) {
  if (selected.kind === "lesson" && (activeLesson?.type === "quiz" || activeLesson?.quiz)) {
    return ["Add 4 quiz questions", "Improve this quiz", "Rename the course"];
  }
  if (selected.kind === "lesson" && activeLesson?.type === "video") {
    return ["Improve this", "Add a quiz", "Rename the course"];
  }
  if (selected.kind === "lesson") {
    return ["Make definitions cards", "Beautify this lesson", "Add an assignment to this"];
  }
  if (selected.kind === "overview") {
    return ["Rename the course", "Improve the description", "Add a quiz"];
  }
  return ["Rename the course", "Add 2 lessons", "Add a quiz"];
}

export function CourseBuilder({
  program,
  initialTab = "build",
  surface = "admin",
}: {
  program: CatalogProgramDetail;
  initialTab?: Tab;
  surface?: "admin" | "instructor";
}) {
  const instructor = surface === "instructor";
  const router = useRouter();
  const [currentProgram, setCurrentProgram] = useState(program);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [requested, setSelected] = useState<BuilderNode>({ kind: "overview" });
  const [whitbyMessages, setWhitbyMessages] = useState<WhitbyMessage[]>(() => [
    {
      id: "welcome",
      role: "whitby",
      content:
        "I’m your course co-author. I’ll read what you say, understand it, then answer or edit — ask anything about this course, or tell me what to change.",
    },
  ]);
  const [chatOpen, setChatOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotKey(program));
  const isDirty = snapshotKey(currentProgram) !== savedSnapshot;
  const programRef = useRef(currentProgram);
  programRef.current = currentProgram;
  const locked = false;
  const hasUnpublishedChanges = Boolean(currentProgram.hasUnpublishedChanges);

  const undoKey = `pa-whitby-undo:${program.id}`;
  const redoKey = `pa-whitby-redo:${program.id}`;
  const undoStackRef = useRef<CatalogProgramDetail[]>([]);
  const redoStackRef = useRef<CatalogProgramDetail[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [undoing, setUndoing] = useState(false);
  const undoingRef = useRef(false);
  const reloadSeq = useRef(0);
  const fillMissingRef = useRef(false);

  function persistStack(key: string, stack: CatalogProgramDetail[]) {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(stack));
    } catch {
      /* quota / private mode */
    }
  }

  function cloneSnapshot(snapshot: CatalogProgramDetail): CatalogProgramDetail {
    return structuredClone({
      ...snapshot,
      hasUnpublishedChanges: Boolean(snapshot.hasUnpublishedChanges),
    });
  }

  function pushUndoSnapshot(snapshot: CatalogProgramDetail) {
    const stack = undoStackRef.current;
    stack.push(cloneSnapshot(snapshot));
    if (stack.length > 20) stack.shift();
    undoStackRef.current = stack;
    setUndoDepth(stack.length);
    persistStack(undoKey, stack);
    // A new Whitby change invalidates any redo path.
    redoStackRef.current = [];
    setRedoDepth(0);
    persistStack(redoKey, []);
  }

  function pushRedoSnapshot(snapshot: CatalogProgramDetail) {
    const stack = redoStackRef.current;
    stack.push(cloneSnapshot(snapshot));
    if (stack.length > 20) stack.shift();
    redoStackRef.current = stack;
    setRedoDepth(stack.length);
    persistStack(redoKey, stack);
  }

  useEffect(() => {
    const docked = window.matchMedia(BUILDER_DOCKED_MQ);
    function syncChatToViewport() {
      if (docked.matches) {
        try {
          setChatOpen(window.localStorage.getItem("pa-whitby-chat-open") !== "0");
        } catch {
          setChatOpen(true);
        }
      } else {
        setChatOpen(false);
      }
    }
    syncChatToViewport();
    docked.addEventListener("change", syncChatToViewport);
    try {
      const rawUndo = window.sessionStorage.getItem(undoKey);
      if (rawUndo) {
        const parsed = JSON.parse(rawUndo) as CatalogProgramDetail[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          undoStackRef.current = parsed;
          setUndoDepth(parsed.length);
        }
      }
      const rawRedo = window.sessionStorage.getItem(redoKey);
      if (rawRedo) {
        const parsed = JSON.parse(rawRedo) as CatalogProgramDetail[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          redoStackRef.current = parsed;
          setRedoDepth(parsed.length);
        }
      }
    } catch {
      /* ignore */
    }
    return () => docked.removeEventListener("change", syncChatToViewport);
  }, [redoKey, undoKey]);

  useEffect(() => {
    if (fillMissingRef.current) return;
    const missingLessons = currentProgram.modules
      .flatMap((module) => module.lessons)
      .filter((lesson) => lessonNeedsTeachingBody(lesson.type, lesson.contentBody));
    if (!missingLessons.length) return;
    // From-scratch outlines use blank "New lesson" rows — those are written by
    // the instructor, not auto-generated. Only backfill Whitby-generated gaps.
    const scratchPlaceholders = missingLessons.every(
      (lesson) =>
        lesson.title.trim() === "New lesson" &&
        !lesson.contentBody.trim() &&
        lesson.learningObjectives.length === 0,
    );
    if (scratchPlaceholders) return;
    const missing = missingLessons.length;
    fillMissingRef.current = true;
    setSaveMessage(`Writing ${missing} missing lesson${missing === 1 ? "" : "s"}…`);
    void fillMissingLessonBodiesAction(currentProgram.id).then(async (result) => {
      if (result.ok && result.filled > 0) {
        const reloaded = await loadCatalogProgramAction(currentProgram.id);
        if (reloaded.ok) {
          setCurrentProgram(reloaded.program);
          setSavedSnapshot(snapshotKey(reloaded.program));
        }
        setSaveMessage("Lesson content added");
        return;
      }
      if (!result.ok) {
        fillMissingRef.current = false;
        setSaveMessage(result.message || "Could not write missing lesson content.");
        return;
      }
      setSaveMessage(null);
    });
  }, [currentProgram.id, currentProgram.modules]);

  function toggleChat() {
    setChatOpen((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("pa-whitby-chat-open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleOutline() {
    setOutlineOpen((open) => {
      const next = !open;
      if (next) setChatOpen(false);
      return next;
    });
  }

  function closeMobileOutline() {
    if (typeof window !== "undefined" && window.matchMedia(OUTLINE_DOCKED_MQ).matches) return;
    setOutlineOpen(false);
  }

  function selectBuilderNode(node: BuilderNode) {
    setSelected(node);
    closeMobileOutline();
  }

  function handleToggleChat() {
    if (tab !== "build") {
      if (chatOpen) {
        toggleChat();
      } else {
        setTab("build");
        setOutlineOpen(false);
        setChatOpen(true);
        try {
          window.localStorage.setItem("pa-whitby-chat-open", "1");
        } catch {
          /* ignore */
        }
      }
      return;
    }
    setOutlineOpen(false);
    toggleChat();
  }

  const whitbyPanelVisible = !locked && tab === "build";

  const resolved = useMemo(() => {
    if (requested.kind === "lesson") {
      const module = currentProgram.modules.find((entry) => entry.id === requested.moduleId);
      const lesson = module?.lessons.find((entry) => entry.id === requested.lessonId);
      if (module && lesson) return { node: requested, module, lesson };
    }
    return { node: { kind: "overview" } as BuilderNode, module: undefined, lesson: undefined };
  }, [currentProgram.modules, requested]);

  const selected = resolved.node;
  const activeModule = resolved.module;
  const activeLesson = resolved.lesson;
  const whitbyContext = useMemo(() => {
    const recentChat = whitbyMessages
      .filter((message) => message.id !== "welcome")
      .slice(-14)
      .map((message) => ({
        role: message.role === "user" ? ("user" as const) : ("whitby" as const),
        content: message.content,
      }));
    return buildWhitbyContext(selected, currentProgram, activeModule, activeLesson, recentChat);
  }, [activeLesson, activeModule, currentProgram, selected, whitbyMessages]);

  function applyProgram(next: CatalogProgramDetail, node?: BuilderNode) {
    setCurrentProgram(next);
    if (node) setSelected(node);
  }

  async function persistCover(coverImageUrl: string) {
    const result = await saveAdminCatalogCoverAction(currentProgram.id, coverImageUrl);
    if (!result.ok) {
      return { ok: false, message: result.message ?? "The cover could not be saved." };
    }
    setSavedSnapshot((current) => {
      const parsed = JSON.parse(current) as SaveAdminCatalogDraftInput;
      return JSON.stringify({ ...parsed, coverImageUrl });
    });
    return { ok: true };
  }

  async function reloadProgram() {
    const seq = ++reloadSeq.current;
    const previousLessonTitle = activeLesson?.title;
    const previousModuleTitle = activeModule?.title;
    const stayOnOverview = selected.kind === "overview";
    const reloaded = await loadCatalogProgramAction(programRef.current.id);
    if (!reloaded.ok) return null;
    if (seq !== reloadSeq.current) return reloaded.program;
    if (stayOnOverview) {
      applyProgram(reloaded.program, { kind: "overview" });
    } else {
      const nextModule =
        reloaded.program.modules.find((module) => module.title === previousModuleTitle) ??
        reloaded.program.modules[0];
      const nextLesson =
        nextModule?.lessons.find((lesson) => lesson.title === previousLessonTitle) ??
        nextModule?.lessons[0];
      applyProgram(
        reloaded.program,
        nextModule && nextLesson
          ? { kind: "lesson", moduleId: nextModule.id, lessonId: nextLesson.id }
          : { kind: "overview" },
      );
    }
    setSavedSnapshot((prev) => {
      // Whitby/AI persists immediately into unpublished_draft for live programs.
      // Keep dirty baseline so Save / Publish changes stay visible until user confirms.
      if (programRef.current.status === "published") return prev;
      return snapshotKey(reloaded.program);
    });
    return reloaded.program;
  }

  async function saveDraft() {
    if (!isDirty) {
      setSaveMessage("No changes to save");
      return true;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await saveAdminCatalogDraftAction(buildDraftPayload(currentProgram));
      if (!result.ok) {
        setSaveMessage(result.message ?? "The draft could not be saved.");
        return false;
      }
      setCurrentProgram((current) => ({
        ...current,
        hasUnpublishedChanges: current.status === "published" ? true : current.hasUnpublishedChanges,
      }));
      setSavedSnapshot(snapshotKey(currentProgram));
      setSaveMessage(
        currentProgram.status === "published" ? "Saved for later publish" : "Saved",
      );
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function publishDraft() {
    if (instructor) {
      const canDirect = Boolean(currentProgram.canPublishWithoutApproval);
      const alreadyLive = currentProgram.status === "published";

      // Live + no edits: nothing to submit or publish.
      if (alreadyLive && !isDirty && !hasUnpublishedChanges) {
        setSaveMessage("This course is already live — no changes to submit.");
        return;
      }

      if (canDirect) {
        // fall through to save + publish / apply
      } else {
        const approved =
          currentProgram.latestRequestStatus === "approved" &&
          !isDirty &&
          (!alreadyLive || hasUnpublishedChanges);

        if (!approved) {
          if (
            currentProgram.latestRequestStatus === "pending" ||
            (currentProgram.status === "pending_approval" &&
              currentProgram.latestRequestStatus !== "approved")
          ) {
            return;
          }
          setConfirm({ kind: "submit" });
          return;
        }
      }
    }

    const alreadyLive = currentProgram.status === "published";
    if (alreadyLive && !isDirty && !hasUnpublishedChanges) {
      setSaveMessage("No changes to publish");
      return;
    }

    setPublishing(true);
    setSaveMessage(null);
    try {
      if (isDirty) {
        const saved = await saveDraft();
        if (!saved) {
          setSaveMessage((current) => current ?? "Save the draft before publishing.");
          return;
        }
      }

      if (alreadyLive) {
        if (instructor) {
          const result = await publishProgramAction(currentProgram.id);
          if (result.ok) {
            setCurrentProgram((current) => ({ ...current, hasUnpublishedChanges: false }));
            setSavedSnapshot(snapshotKey({ ...currentProgram, hasUnpublishedChanges: false }));
            setSaveMessage("Changes published");
            router.refresh();
            return;
          }
          setSaveMessage(result.message ?? "The changes could not be published.");
          return;
        }

        const result = await applyUnpublishedDraftAction(currentProgram.id);
        if (result.ok) {
          setCurrentProgram((current) => ({ ...current, hasUnpublishedChanges: false }));
          setSavedSnapshot(snapshotKey({ ...currentProgram, hasUnpublishedChanges: false }));
          setSaveMessage("Changes published");
          router.refresh();
          return;
        }
        setSaveMessage(result.message ?? "The changes could not be published.");
        return;
      }

      if (instructor) {
        const result = await publishProgramAction(currentProgram.id);
        if (result.ok) {
          setCurrentProgram((current) => ({ ...current, status: "published" }));
          setSaveMessage("Published");
          return;
        }
        setSaveMessage(result.message ?? "The program could not be published.");
        return;
      }

      const result = await publishAdminCatalogProgramAction(currentProgram.id);
      if (result.ok) {
        setCurrentProgram((current) => ({ ...current, status: result.status }));
        setSaveMessage("Published");
        return;
      }
      setSaveMessage(result.message ?? "The program could not be published.");
    } finally {
      setPublishing(false);
    }
  }

  async function submitForApproval() {
    if (
      currentProgram.status === "published" &&
      !isDirty &&
      !hasUnpublishedChanges
    ) {
      setSaveMessage("This course is already live — no changes to submit.");
      setConfirm(null);
      return;
    }
    setPublishing(true);
    setSaveMessage(null);
    try {
      if (isDirty) {
        const saved = await saveDraft();
        if (!saved) {
          setSaveMessage((current) => current ?? "Save the draft before submitting.");
          return;
        }
      }
      const result = await submitPublishRequestAction(currentProgram.id);
      if (!result.ok) {
        setSaveMessage(result.message ?? "The request could not be submitted.");
        return;
      }
      setCurrentProgram((current) => ({
        ...current,
        status: current.status === "published" ? "published" : "pending_approval",
        latestRequestStatus: "pending",
      }));
      setSaveMessage(
        result.status === "already_pending"
          ? "Already waiting for review"
          : currentProgram.status === "published"
            ? "Unpublished edits submitted for approval"
            : "Submitted for approval",
      );
    } finally {
      setPublishing(false);
      setConfirm(null);
    }
  }

  async function unpublishDraft() {
    setPublishing(true);
    try {
      const result = await unpublishAdminCatalogProgramAction(currentProgram.id);
      if (result.ok) {
        setCurrentProgram((current) => ({ ...current, status: result.status }));
        setConfirm(null);
        router.refresh();
        return;
      }
      setSaveMessage(result.message ?? "The program could not be hidden.");
      setConfirm(null);
    } finally {
      setPublishing(false);
    }
  }

  async function revertToPublished() {
    setReverting(true);
    setSaveMessage(null);
    try {
      const result = await discardUnpublishedDraftAction(currentProgram.id);
      if (!result.ok) {
        setSaveMessage(result.message ?? "Could not revert to the published version.");
        setConfirm(null);
        return;
      }
      const reloaded = await loadCatalogProgramAction(currentProgram.id);
      if (!reloaded.ok) {
        setSaveMessage("Reverted, but the live version could not be reloaded. Refresh the page.");
        setConfirm(null);
        return;
      }
      setCurrentProgram({ ...reloaded.program, hasUnpublishedChanges: false });
      setSavedSnapshot(snapshotKey({ ...reloaded.program, hasUnpublishedChanges: false }));
      setSelected({ kind: "overview" });
      setSaveMessage("Reverted to published version");
      setConfirm(null);
      router.refresh();
    } finally {
      setReverting(false);
    }
  }

  async function deleteProgram() {
    const block = getCatalogProgramDeletionBlock({
      status: currentProgram.status,
      enrollmentCount: currentProgram.enrollmentCount,
      activeEnrollmentCount: currentProgram.activeEnrollmentCount,
    });
    if (block) {
      setSaveMessage(catalogProgramDeletionMessage(block, currentProgram.activeEnrollmentCount));
      setConfirm(null);
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteAdminCatalogProgramAction(currentProgram.id);
      if (!result.ok) {
        setSaveMessage(result.message ?? "The program could not be deleted.");
        setConfirm(null);
        return;
      }
      router.replace("/academy/admin/programs");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    if (!confirm) return;
    if (confirm.kind === "submit") {
      void submitForApproval();
      return;
    }
    if (confirm.kind === "hide") {
      void unpublishDraft();
      return;
    }
    if (confirm.kind === "revert") {
      void revertToPublished();
      return;
    }
    if (confirm.kind === "program") {
      void deleteProgram();
      return;
    }
    if (confirm.kind === "module") {
      applyProgram(deleteModule(currentProgram, confirm.moduleId), { kind: "overview" });
    } else {
      applyProgram(deleteLesson(currentProgram, confirm.lessonId), { kind: "overview" });
    }
    setConfirm(null);
  }

  async function runWhitbyInstruction(instruction: string) {
    const draft = programRef.current;
    return refineCatalogProgramAction(draft.id, instruction, {
      context: whitbyContext,
      draft: buildDraftPayload(draft),
      actionId: crypto.randomUUID(),
    });
  }

  async function instructWhitby(instruction: string): Promise<string | WhitbyReply> {
    // “What did you change?” / “where are the changes?” — explain, never undo.
    if (
      /\bwhere\b.{0,40}\b(the\s+)?(change|changes|edits?)\b/i.test(instruction) ||
      /\bwhat you (change|changed|do|did)\b/i.test(instruction) ||
      /\b(what|tell|show|explain).{0,40}\b(you\s+)?(change|changed|edit|edited)\b/i.test(instruction)
    ) {
      const lastDone = [...whitbyMessages]
        .reverse()
        .find((m) => m.role === "whitby" && /^Done\s*[—–-]/i.test(m.content));
      if (lastDone) {
        const summary = lastDone.content
          .replace(/^Done\s*[—–-]\s*/i, "")
          .replace(/\s*Your changes are saved[\s\S]*$/i, "")
          .replace(/\s*You can undo[\s\S]*$/i, "")
          .trim();
        return `Here’s what I changed last: ${summary} Open that lesson in the outline (left) and scroll to the section I named. If it’s not visible, click the lesson again to refresh.`;
      }
      return "I don’t see a recent Done edit in this chat. After I change something, ask again and I’ll point to it — or open lesson 1.1 and check the section you asked me to expand.";
    }

    // Chat "undo" / "remove changes" should drive the same path as the Undo button.
    if (
      /^(undo|revert)\b/i.test(instruction.trim()) ||
      /\b(undo|revert|roll\s*back)\b/i.test(instruction) ||
      /\b(remove|discard|cancel|drop|take back)\b.{0,28}\b(those\s+|the\s+|these\s+|my\s+)?(changes|edits|plan)\b/i.test(
        instruction,
      ) ||
      /\bremove changes\b/i.test(instruction)
    ) {
      // Don't treat “what/where … changes” as undo (handled above).
      if (!/\b(where|what|tell|show|explain)\b/i.test(instruction)) {
        if (undoStackRef.current.length === 0) {
          return "Nothing to undo yet. After I change the outline, use Undo above the chat (or say undo again).";
        }
        const undone = await undoLastWhitbyChange({ silent: true });
        return undone
          ? "Undone — I put the course back to how it was before that last change. Use Redo above if you want those edits back."
          : "I couldn’t undo that change. Try the Undo button above, or refresh and try again.";
      }
    }

    if (/\b(redo|reapply|restore)\b.{0,20}\b(change|changes|edits|that)?\b/i.test(instruction) || /^\s*redo\s*$/i.test(instruction)) {
      if (redoStackRef.current.length === 0) {
        return "Nothing to redo yet. Undo a change first, then use Redo above the chat.";
      }
      const redone = await redoLastWhitbyChange({ silent: true });
      return redone
        ? "Redone — I put Whitby’s latest changes back."
        : "I couldn’t redo that change. Try the Redo button above.";
    }

    const result = await runWhitbyInstruction(instruction);
    if (!result.ok) {
      return result.message ?? "Whitby could not apply that instruction.";
    }
    const summary = result.summary?.trim() || "Updated the program based on your instruction.";

    // Risky change — return the plan so the chat shows [Apply] / [Cancel]
    // instead of committing. Nothing has changed yet.
    if (result.requiresApproval && result.pendingToken) {
      return {
        text: summary,
        plan: {
          token: result.pendingToken,
          payload: result.pendingPayload,
          steps: result.plan ?? [],
          risk: result.risk ?? "medium",
        },
      };
    }

    if (result.mutated === false) {
      return summary;
    }

    // Snapshot the builder as it was before Whitby wrote, then reload the
    // saved outline. Undo is enabled only after that reload so the button
    // cannot fire against a half-applied change.
    const before = structuredClone(programRef.current);
    if (/\b(remove|delete)\b/i.test(instruction) && !/\b(changes|edits|plan)\b/i.test(instruction)) {
      const refs = parseDottedLessonRefs(instruction);
      if (refs.length > 0) {
        applyProgram(deleteLessonsByNumbers(programRef.current, refs), { kind: "overview" });
      }
    }
    try {
      await applyRefinedProgram();
    } catch {
      return "I prepared the edit but could not reload the saved program. Refresh the page and check whether the change landed — I will not mark this as Done until it is verified.";
    }
    pushUndoSnapshot(before);
    return `Done — ${summary} Your changes are saved in the builder. You can undo this above.`;
  }

  async function approveWhitbyPlan(
    token: string,
    payload?: string,
  ): Promise<{ ok: boolean; message: string }> {
    const before = structuredClone(programRef.current);
    const result = await refineCatalogProgramAction(programRef.current.id, "", {
      confirmToken: token,
      confirmPayload: payload,
      actionId: crypto.randomUUID(),
    });
    if (!result.ok) {
      return {
        ok: false,
        message: result.message ?? "That change could not be applied. Try Apply again.",
      };
    }
    const summary = result.summary?.trim() || "Applied your changes.";
    await applyRefinedProgram();
    pushUndoSnapshot(before);
    return { ok: true, message: `Done — ${summary} You can undo this above.` };
  }

  async function restoreWhitbySnapshot(
    snapshot: CatalogProgramDetail,
    options?: { silent?: boolean; mode: "undo" | "redo" },
  ): Promise<boolean> {
    undoingRef.current = true;
    setUndoing(true);
    setSaveMessage(null);
    reloadSeq.current += 1;

    const restoreCleanPublished =
      snapshot.status === "published" && !snapshot.hasUnpublishedChanges;

    try {
      const result = restoreCleanPublished
        ? await discardUnpublishedDraftAction(snapshot.id)
        : await saveAdminCatalogDraftAction({
            ...buildDraftPayload(snapshot),
            replaceStructure: true,
          });

      if (!result.ok) {
        setSaveMessage(result.message ?? `That change could not be ${options?.mode === "redo" ? "redone" : "undone"}.`);
        return false;
      }

      const reloaded = await reloadProgram();
      const restored: CatalogProgramDetail = reloaded
        ? {
            ...reloaded,
            hasUnpublishedChanges: restoreCleanPublished
              ? false
              : Boolean(reloaded.hasUnpublishedChanges),
          }
        : {
            ...snapshot,
            hasUnpublishedChanges: restoreCleanPublished
              ? false
              : Boolean(snapshot.hasUnpublishedChanges),
          };

      if (!reloaded || restoreCleanPublished || snapshot.status === "published") {
        applyProgram(restored, { kind: "overview" });
        setSavedSnapshot(snapshotKey(restored));
      } else {
        setSavedSnapshot(snapshotKey(restored));
      }

      const mode = options?.mode ?? "undo";
      setSaveMessage(mode === "redo" ? "Redone" : "Undone");
      if (!options?.silent) {
        setWhitbyMessages((messages) => [
          ...messages,
          {
            id: crypto.randomUUID(),
            role: "whitby",
            content:
              mode === "redo"
                ? "Redone — I put those changes back."
                : "Undone — I put the course back to how it was before that last change. Use Redo if you want them again.",
          },
        ]);
      }
      return true;
    } finally {
      undoingRef.current = false;
      setUndoing(false);
    }
  }

  async function undoLastWhitbyChange(options?: { silent?: boolean }): Promise<boolean> {
    if (undoingRef.current) return false;
    const snapshot = undoStackRef.current.pop();
    setUndoDepth(undoStackRef.current.length);
    persistStack(undoKey, undoStackRef.current);
    if (!snapshot) return false;

    // Keep the current (newer) outline so Redo can bring it back.
    pushRedoSnapshot(programRef.current);

    const ok = await restoreWhitbySnapshot(snapshot, { silent: options?.silent, mode: "undo" });
    if (!ok) {
      // Roll the stacks back if restore failed.
      const failedCurrent = redoStackRef.current.pop();
      setRedoDepth(redoStackRef.current.length);
      persistStack(redoKey, redoStackRef.current);
      undoStackRef.current.push(snapshot);
      setUndoDepth(undoStackRef.current.length);
      persistStack(undoKey, undoStackRef.current);
      if (failedCurrent) {
        /* current builder state was already live — nothing else to restore */
      }
    }
    return ok;
  }

  async function redoLastWhitbyChange(options?: { silent?: boolean }): Promise<boolean> {
    if (undoingRef.current) return false;
    const snapshot = redoStackRef.current.pop();
    setRedoDepth(redoStackRef.current.length);
    persistStack(redoKey, redoStackRef.current);
    if (!snapshot) return false;

    // Current (undone) outline goes onto undo so Undo works again.
    const stack = undoStackRef.current;
    stack.push(cloneSnapshot(programRef.current));
    if (stack.length > 20) stack.shift();
    undoStackRef.current = stack;
    setUndoDepth(stack.length);
    persistStack(undoKey, stack);

    const ok = await restoreWhitbySnapshot(snapshot, { silent: options?.silent, mode: "redo" });
    if (!ok) {
      undoStackRef.current.pop();
      setUndoDepth(undoStackRef.current.length);
      persistStack(undoKey, undoStackRef.current);
      redoStackRef.current.push(snapshot);
      setRedoDepth(redoStackRef.current.length);
      persistStack(redoKey, redoStackRef.current);
    }
    return ok;
  }

  async function applyRefinedProgram() {
    await reloadProgram();
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas">
      <CourseBuilderTopBar
        programName={currentProgram.name}
        status={currentProgram.status}
        activeTab={tab}
        programId={currentProgram.id}
        isPublished={currentProgram.status === "published"}
        onTabChange={(next) => {
          setTab(next);
          closeMobileOutline();
        }}
        onSave={saveDraft}
        saving={saving}
        publishing={publishing}
        hasChanges={isDirty}
        hasUnpublishedChanges={hasUnpublishedChanges}
        enrollmentCount={currentProgram.enrollmentCount}
        onPublish={publishDraft}
        onUnpublish={instructor ? undefined : () => setConfirm({ kind: "hide" })}
        onRevert={
          currentProgram.status === "published"
            ? () => setConfirm({ kind: "revert" })
            : undefined
        }
        reverting={reverting}
        chatOpen={locked ? false : chatOpen}
        onToggleChat={locked ? undefined : handleToggleChat}
        outlineOpen={outlineOpen}
        onToggleOutline={tab === "build" ? toggleOutline : undefined}
        backHref={instructor ? "/academy/instructor/programs" : "/academy/admin/programs"}
        surface={surface}
        requestStatus={currentProgram.latestRequestStatus ?? null}
        canPublishWithoutApproval={Boolean(currentProgram.canPublishWithoutApproval)}
      />
      {saveMessage ? (
        <p
          className="shrink-0 border-b px-4 py-2 text-[13px]"
          style={{
            borderColor: "var(--border)",
            color:
              saveMessage === "Saved" ||
              saveMessage === "Saved for later publish" ||
              saveMessage === "Published" ||
              saveMessage === "Changes published" ||
              saveMessage === "Reverted to published version" ||
              saveMessage === "Undone" ||
              saveMessage === "Redone" ||
              saveMessage === "Submitted for approval" ||
              saveMessage === "Unpublished edits submitted for approval" ||
              saveMessage === "Already waiting for review"
                ? "var(--text-secondary)"
                : "#c4554d",
            background: "var(--surface)",
          }}
        >
          {saveMessage}
        </p>
      ) : null}

      {currentProgram.status === "published" && (hasUnpublishedChanges || isDirty) ? (
        <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <Callout tone="warning" title="Unpublished edits">
            Learners still see the live course. Use Save to stage changes, Publish changes
            {instructor && !currentProgram.canPublishWithoutApproval
              ? " after admin approval"
              : ""}{" "}
            when you are ready, or Revert to discard edits.
          </Callout>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProgramSettings
            program={currentProgram}
            disabled={locked}
            showFinalAssessment={!instructor}
            onChange={(patch) => {
              if (locked) return;
              setCurrentProgram((current) => ({ ...current, ...patch }));
            }}
            onDeleteProgram={
              instructor
                ? undefined
                : () => {
                    if (
                      !catalogProgramCanBeDeleted({
                        status: currentProgram.status,
                        enrollmentCount: currentProgram.enrollmentCount,
                        activeEnrollmentCount: currentProgram.activeEnrollmentCount,
                      })
                    ) {
                      return;
                    }
                    setConfirm({ kind: "program" });
                  }
            }
          />
        </div>
      ) : tab === "preview" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProgramPreview program={currentProgram} requiresApproval={instructor} />
        </div>
      ) : (
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
          {outlineOpen || (whitbyPanelVisible && chatOpen) ? (
            <button
              type="button"
              aria-label="Close panel"
              className={cn(
                "absolute inset-0 z-30",
                whitbyPanelVisible && chatOpen ? "lg:hidden" : "md:hidden",
              )}
              style={{ background: "rgba(55,53,47,0.28)" }}
              onClick={() => {
                closeMobileOutline();
                setChatOpen(false);
              }}
            />
          ) : null}
          <div
            className={cn(
              "min-h-0 flex-col overflow-hidden border-r",
              "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(280px,88vw)] max-md:shadow-float",
              "md:relative md:z-0 md:w-[268px] md:shrink-0",
              outlineOpen ? "flex" : "hidden md:flex",
            )}
            style={{
              borderColor: "var(--border)",
              background:
                "linear-gradient(180deg, var(--surface-soft) 0%, var(--surface) 48%, var(--surface) 100%)",
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 md:hidden"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                Outline
              </p>
              <button
                type="button"
                onClick={() => setOutlineOpen(false)}
                aria-label="Close outline"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-black/[0.04]"
                style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="pa-no-scrollbar min-h-0 flex-1 overflow-y-auto">
            <ModuleTree
              modules={currentProgram.modules}
              selected={selected}
              onSelect={selectBuilderNode}
              onAddModule={
                locked
                  ? undefined
                  : (afterModuleId) => {
                      const result = addModule(currentProgram, afterModuleId);
                      applyProgram(result.program, {
                        kind: "lesson",
                        moduleId: result.module.id,
                        lessonId: result.module.lessons[0]?.id ?? "",
                      });
                      closeMobileOutline();
                    }
              }
              onAddLesson={
                locked
                  ? undefined
                  : (moduleId) => {
                      const result = addLesson(
                        currentProgram,
                        moduleId,
                        selected.kind === "lesson" && selected.moduleId === moduleId
                          ? selected.lessonId
                          : undefined,
                      );
                      applyProgram(result.program, {
                        kind: "lesson",
                        moduleId,
                        lessonId: result.lesson.id,
                      });
                      closeMobileOutline();
                    }
              }
              onRenameModule={
                locked
                  ? undefined
                  : (moduleId, title) => {
                      setCurrentProgram((current) => ({
                        ...current,
                        modules: current.modules.map((module) =>
                          module.id === moduleId ? { ...module, title } : module,
                        ),
                      }));
                    }
              }
              onDeleteModule={
                locked
                  ? undefined
                  : (moduleId) => {
                      const module = currentProgram.modules.find((item) => item.id === moduleId);
                      if (!module) return;
                      setConfirm({
                        kind: "module",
                        moduleId,
                        title: module.title,
                        lessonCount: module.lessons.length,
                      });
                    }
              }
              onDeleteLesson={
                locked
                  ? undefined
                  : (moduleId, lessonId) => {
                      const lesson = currentProgram.modules
                        .find((item) => item.id === moduleId)
                        ?.lessons.find((item) => item.id === lessonId);
                      if (!lesson) return;
                      setConfirm({ kind: "lesson", moduleId, lessonId, title: lesson.title });
                    }
              }
              onMoveModule={
                locked
                  ? undefined
                  : (moduleId, direction) => {
                      setCurrentProgram(moveModule(currentProgram, moduleId, direction));
                    }
              }
              onMoveLesson={
                locked
                  ? undefined
                  : (moduleId, lessonId, direction) => {
                      setCurrentProgram(moveLesson(currentProgram, moduleId, lessonId, direction));
                    }
              }
            />
            </div>
          </div>

          <ScrollPane
            as="main"
            resetKey={selected.kind === "lesson" ? selected.lessonId : "overview"}
            className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
            style={{ background: "var(--canvas, #f1f1ef)" }}
          >
            {selected.kind === "overview" ? (
              <OverviewPane
                program={currentProgram}
                busy={saving || publishing || locked}
                compact={chatOpen}
                onPatch={(patch) => {
                  if (locked) return;
                  setCurrentProgram((current) => ({ ...current, ...patch }));
                }}
                onCoverPersist={locked ? undefined : persistCover}
                onSettings={() => setTab("settings")}
                onImprove={
                  locked
                    ? undefined
                    : () => {
                        setOutlineOpen(false);
                        setChatOpen(true);
                        try {
                          window.localStorage.setItem("pa-whitby-chat-open", "1");
                        } catch {
                          /* ignore */
                        }
                      }
                }
              />
            ) : activeLesson && activeModule ? (
              <LessonEditor
                key={activeLesson.id}
                lesson={activeLesson}
                programId={currentProgram.id}
                moduleTitle={activeModule.title}
                moduleIndex={currentProgram.modules.indexOf(activeModule)}
                lessonIndex={activeModule.lessons.indexOf(activeLesson)}
                disabled={locked}
                onChange={(patch) => {
                  if (locked) return;
                  setCurrentProgram((current) => ({
                    ...current,
                    modules: current.modules.map((module) =>
                      module.id !== activeModule.id
                        ? module
                        : {
                            ...module,
                            lessons: module.lessons.map((lesson) =>
                              lesson.id === activeLesson.id ? { ...lesson, ...patch } : lesson,
                            ),
                          },
                    ),
                  }));
                }}
                onDelete={
                  locked
                    ? undefined
                    : () =>
                        setConfirm({
                          kind: "lesson",
                          moduleId: activeModule.id,
                          lessonId: activeLesson.id,
                          title: activeLesson.title,
                        })
                }
              />
            ) : (
              <div
                className="flex flex-1 items-center justify-center px-8 py-16 text-[14px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Add a module to start editing this course.
              </div>
            )}
          </ScrollPane>

          {whitbyPanelVisible ? (
            chatOpen ? (
            <aside
              className={cn(
                "flex h-full min-h-0 flex-col border-l",
                "max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-[min(360px,92vw)] max-lg:shadow-float",
                "lg:relative lg:z-10 lg:w-[280px] lg:shrink-0",
              )}
              style={{
                borderColor: "var(--border)",
                background: "var(--surface)",
                transition: "width 280ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <div
                className="flex items-center justify-between gap-3 border-b px-4 py-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold text-white"
                    style={{ background: "var(--accent, #2383e2)" }}
                  >
                    W
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p
                        className="truncate text-[13.5px] font-semibold tracking-[-0.02em]"
                        style={{ color: "var(--ink)" }}
                      >
                        Whitby
                      </p>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          background: "var(--success-bg, #d6ecd8)",
                          color: "var(--success-fg, #1c7a52)",
                        }}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: "var(--success-fg, #1c7a52)" }}
                        />
                        Ready
                      </span>
                    </div>
                    <p
                      className="mt-0.5 truncate whitespace-nowrap text-[11.5px] leading-snug"
                      style={{ color: "var(--text-tertiary)" }}
                      title="Course co-author"
                    >
                      Course co-author
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => void undoLastWhitbyChange()}
                    disabled={undoing || undoDepth === 0}
                    title={
                      undoing
                        ? "Working…"
                        : undoDepth === 0
                          ? "Nothing to undo"
                          : `Undo Whitby's last change (${undoDepth} available)`
                    }
                    aria-label="Undo"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
                    style={{ color: "var(--text-secondary)", background: "transparent", border: "none" }}
                  >
                    <UndoIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => void redoLastWhitbyChange()}
                    disabled={undoing || redoDepth === 0}
                    title={
                      undoing
                        ? "Working…"
                        : redoDepth === 0
                          ? "Nothing to redo"
                          : `Redo Whitby's change (${redoDepth} available)`
                    }
                    aria-label="Redo"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
                    style={{ color: "var(--text-secondary)", background: "transparent", border: "none" }}
                  >
                    <RedoIcon />
                  </button>
                  <button
                    type="button"
                    onClick={toggleChat}
                    aria-label="Hide Whitby"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] hover:bg-black/[0.04]"
                    style={{ color: "var(--text-tertiary)", background: "transparent", border: "none" }}
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                <WhitbyChat
                  messages={whitbyMessages}
                  onMessagesChange={setWhitbyMessages}
                  placeholder={whitbyPlaceholder(selected, activeLesson)}
                  suggestions={whitbySuggestions(selected, activeLesson)}
                  onSend={instructWhitby}
                  onApprovePlan={approveWhitbyPlan}
                />
              </div>
            </aside>
            ) : (
            <div
              className="relative z-10 hidden w-12 shrink-0 flex-col items-center border-l py-3 lg:flex"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <button
                type="button"
                onClick={toggleChat}
                title="Show Whitby"
                aria-label="Show Whitby"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] text-[11px] font-bold text-white hover:opacity-90"
                style={{ background: "var(--accent, #2383e2)", border: "none" }}
              >
                W
              </button>
            </div>
            )
          ) : null}
        </div>
      )}

      {confirm ? (
        <ConfirmDialog
          title={
            confirm.kind === "submit"
              ? "Submit for approval?"
              : confirm.kind === "hide"
              ? "Hide this program?"
              : confirm.kind === "revert"
                ? "Revert to published version?"
              : confirm.kind === "program"
                ? "Delete this course?"
                : confirm.kind === "module"
                  ? "Delete this module?"
                  : "Delete this lesson?"
          }
          body={
            confirm.kind === "submit"
              ? `"${currentProgram.name}" will go to an Academy Admin. You cannot publish it until they approve.`
              : confirm.kind === "hide"
              ? `"${currentProgram.name}" will leave Explore for new learners. Anyone already enrolled can keep learning and keep their certificates.`
              : confirm.kind === "revert"
                ? `Discard unpublished edits for "${currentProgram.name}" and restore the live course learners see now. This cannot be undone.`
              : confirm.kind === "program"
                ? `"${currentProgram.name}" has no enrolled learners and is not published. It will be removed from the catalog. This cannot be undone.`
                : confirm.kind === "module"
                  ? `"${confirm.title}" and its ${confirm.lessonCount} lesson${confirm.lessonCount === 1 ? "" : "s"} will be removed.`
                  : `"${confirm.title}" and its quiz will be removed.`
          }
          confirmLabel={
            confirm.kind === "submit"
              ? "Submit"
              : confirm.kind === "hide"
                ? "Hide from catalog"
                : confirm.kind === "revert"
                  ? "Revert"
                : "Delete"
          }
          pendingLabel={
            confirm.kind === "submit"
              ? "Submitting…"
              : confirm.kind === "hide"
                ? "Hiding…"
                : confirm.kind === "revert"
                  ? "Reverting…"
                : "Deleting…"
          }
          destructive={confirm.kind !== "hide" && confirm.kind !== "submit"}
          pending={
            confirm.kind === "hide" || confirm.kind === "submit"
              ? publishing
              : confirm.kind === "revert"
                ? reverting
                : deleting
          }
          onConfirm={confirmDelete}
          onClose={() => {
            if (publishing || deleting || reverting) return;
            setConfirm(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5 10.5 10.5M10.5 3.5 3.5 10.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M4.2 5.4H9a3 3 0 0 1 0 6H5.5M4.2 5.4 6.4 3.2M4.2 5.4l2.2 2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M9.8 5.4H5a3 3 0 0 0 0 6h3.5M9.8 5.4 7.6 3.2M9.8 5.4 7.6 7.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
