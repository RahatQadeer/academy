"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Callout } from "@/base/components/Callout";
import { ConfirmDialog } from "@/academy/admin/catalog/components/ConfirmDialog";
import { LessonEditor } from "@/academy/admin/catalog/components/LessonEditor";
import { ModuleTree, type BuilderNode } from "@/academy/admin/catalog/components/ModuleTree";
import { OverviewPane } from "@/academy/admin/catalog/components/OverviewPane";
import { ProgramPreview } from "@/academy/admin/catalog/components/ProgramPreview";
import { ProgramSettings } from "@/academy/admin/catalog/components/ProgramSettings";
import {
  addLesson,
  addModule,
  deleteLesson,
  deleteModule,
  moveLesson,
  moveModule,
} from "@/academy/admin/catalog/lib/courseOps";
import type { CatalogProgramDetail } from "@/academy/admin/catalog/types";
import { ScrollPane } from "@/academy/components/ScrollPane";
import {
  publishProgramAction,
  saveProgramCoverAction,
  saveProgramDraftAction,
  submitPublishRequestAction,
} from "../actions";
import {
  applyCatalogToEditor,
  buildInstructorDraftPayload,
  editorProgramToCatalog,
  instructorDraftSnapshot,
} from "../lib/toCatalogProgram";
import type { EditorProgram } from "../types";
import { InstructorCatalogFields } from "./InstructorCatalogFields";
import {
  InstructorCourseBuilderTopBar,
  instructorPrimaryAction,
} from "./InstructorCourseBuilderTopBar";

type Tab = "build" | "preview" | "settings";

type ConfirmState =
  | { kind: "lesson"; moduleId: string; lessonId: string; title: string }
  | { kind: "module"; moduleId: string; title: string; lessonCount: number }
  | { kind: "submit" }
  | { kind: "publish" }
  | { kind: "withdraw" };

function workflowCopy(program: EditorProgram) {
  if (program.status === "published") {
    return {
      tone: "info" as const,
      title: "Live in Explore",
      body: "Published programs cannot be edited here. Ask an Academy Admin if the live catalog needs a change.",
    };
  }
  if (program.latestRequestStatus === "approved") {
    return {
      tone: "success" as const,
      title: "Approved to publish",
      body: "An Academy Admin approved this program. Publish it to Explore, or save further edits — saving withdraws the approval.",
    };
  }
  if (program.latestRequestStatus === "pending" || program.status === "pending_approval") {
    return {
      tone: "warning" as const,
      title: "Waiting for approval",
      body: "You can keep editing. Instructors cannot publish until an Academy Admin approves this request.",
    };
  }
  if (program.latestRequestStatus === "rejected") {
    return {
      tone: "warning" as const,
      title: "Returned",
      body: "The last request was returned. Edit the course, then submit again for approval.",
    };
  }
  return {
    tone: "info" as const,
    title: "Draft",
    body: "Build the program, then submit for approval. It will not appear in Explore until an Academy Admin approves it and you or they publish.",
  };
}

export function InstructorCourseBuilder({ initial }: { initial: EditorProgram }) {
  const [program, setProgram] = useState(initial);
  const [tab, setTab] = useState<Tab>("build");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [requested, setSelected] = useState<BuilderNode>({ kind: "overview" });
  const [savedSnapshot, setSavedSnapshot] = useState(() => instructorDraftSnapshot(initial));
  const isDirty = instructorDraftSnapshot(program) !== savedSnapshot;
  const programRef = useRef(program);
  programRef.current = program;

  const catalog = useMemo(() => editorProgramToCatalog(program), [program]);
  const locked = program.status === "published";
  const scoped = Boolean(program.assignmentScope && program.assignmentScope.moduleIds.length > 0);
  const canMutateStructure = !locked;
  const canAddModules = canMutateStructure && !scoped;
  const lockDetails = locked || scoped;
  const primaryAction = instructorPrimaryAction(program.status, program.latestRequestStatus, isDirty);
  const banner = workflowCopy(program);

  useEffect(() => {
    setProgram(initial);
    setSavedSnapshot(instructorDraftSnapshot(initial));
    setSaveMessage(null);
    setSelected({ kind: "overview" });
  }, [initial]);

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (isDirty && !locked) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [isDirty, locked]);

  const resolved = useMemo(() => {
    if (requested.kind === "lesson") {
      const module = catalog.modules.find((entry) => entry.id === requested.moduleId);
      const lesson = module?.lessons.find((entry) => entry.id === requested.lessonId);
      if (module && lesson) return { node: requested, module, lesson };
    }
    return { node: { kind: "overview" } as BuilderNode, module: undefined, lesson: undefined };
  }, [catalog.modules, requested]);

  const selected = resolved.node;
  const activeModule = resolved.module;
  const activeLesson = resolved.lesson;

  function applyCatalog(next: CatalogProgramDetail, node?: BuilderNode) {
    setProgram((current) => applyCatalogToEditor(current, next));
    if (node) setSelected(node);
  }

  function patchProgram(patch: Partial<EditorProgram>) {
    if (locked) return;
    setProgram((current) => ({ ...current, ...patch }));
  }

  async function persistCover(coverImageUrl: string) {
    const result = await saveProgramCoverAction(program.id, coverImageUrl);
    if (!result.ok) {
      return { ok: false, message: result.message ?? "The cover could not be saved." };
    }
    setSavedSnapshot((current) => {
      const parsed = JSON.parse(current) as ReturnType<typeof buildInstructorDraftPayload>;
      return JSON.stringify({ ...parsed, coverImageUrl });
    });
    return { ok: true };
  }

  async function saveDraft(options?: { skipWithdrawConfirm?: boolean }) {
    if (locked) {
      setSaveMessage("Live programs cannot be edited here.");
      return false;
    }
    if (!isDirty) {
      setSaveMessage("No changes to save");
      return true;
    }
    if (program.latestRequestStatus === "approved" && !options?.skipWithdrawConfirm) {
      setConfirm({ kind: "withdraw" });
      return false;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await saveProgramDraftAction(buildInstructorDraftPayload(program));
      if (!result.ok) {
        setSaveMessage(result.message ?? "The draft could not be saved.");
        return false;
      }
      if (result.data) {
        setProgram(result.data);
        setSavedSnapshot(instructorDraftSnapshot(result.data));
      } else {
        setSavedSnapshot(instructorDraftSnapshot(program));
      }
      setSaveMessage(
        result.approvalWithdrawn
          ? "Saved. Approval was withdrawn because the content changed."
          : "Saved",
      );
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval() {
    if (locked) return;
    setSubmitting(true);
    setSaveMessage(null);
    try {
      if (isDirty) {
        const saved = await saveDraft({ skipWithdrawConfirm: true });
        if (!saved) {
          setSaveMessage((current) => current ?? "Save the draft before submitting.");
          return;
        }
      }
      const result = await submitPublishRequestAction(programRef.current.id);
      if (!result.ok) {
        setSaveMessage(result.message ?? "The request could not be submitted.");
        return;
      }
      const next: EditorProgram = {
        ...programRef.current,
        status: "pending_approval",
        latestRequestStatus: "pending",
      };
      setProgram(next);
      setSavedSnapshot(instructorDraftSnapshot(next));
      setSaveMessage(
        result.status === "already_pending" ? "Already waiting for review" : "Submitted for approval",
      );
    } finally {
      setSubmitting(false);
      setConfirm(null);
    }
  }

  async function publishApproved() {
    setPublishing(true);
    setSaveMessage(null);
    try {
      const result = await publishProgramAction(program.id);
      if (!result.ok) {
        setSaveMessage(result.message ?? "The program could not be published.");
        return;
      }
      const next: EditorProgram = { ...program, status: "published" };
      setProgram(next);
      setSavedSnapshot(instructorDraftSnapshot(next));
      setSaveMessage("Published");
    } finally {
      setPublishing(false);
      setConfirm(null);
    }
  }

  function runPrimary() {
    if (primaryAction === "publish") {
      setConfirm({ kind: "publish" });
      return;
    }
    if (primaryAction === "submit") {
      const lessonCount = catalog.modules.reduce((sum, module) => sum + module.lessons.length, 0);
      if (catalog.modules.length === 0 || lessonCount === 0) {
        setSaveMessage("Add at least one module with a lesson before submitting for approval.");
        return;
      }
      if (!program.name.trim()) {
        setSaveMessage("Give the program a name before submitting.");
        return;
      }
      setConfirm({ kind: "submit" });
    }
  }

  function confirmAction() {
    if (!confirm) return;
    if (confirm.kind === "submit") {
      void submitForApproval();
      return;
    }
    if (confirm.kind === "publish") {
      void publishApproved();
      return;
    }
    if (confirm.kind === "withdraw") {
      setConfirm(null);
      void saveDraft({ skipWithdrawConfirm: true });
      return;
    }
    if (confirm.kind === "module") {
      applyCatalog(deleteModule(catalog, confirm.moduleId), { kind: "overview" });
    } else if (confirm.kind === "lesson") {
      applyCatalog(deleteLesson(catalog, confirm.lessonId), { kind: "overview" });
    }
    setConfirm(null);
  }

  const successMessage =
    saveMessage === "Saved" ||
    saveMessage === "Submitted for approval" ||
    saveMessage === "Already waiting for review" ||
    saveMessage === "Published" ||
    saveMessage === "No changes to save" ||
    Boolean(saveMessage?.startsWith("Saved. Approval"));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <InstructorCourseBuilderTopBar
        programName={program.name}
        status={program.status}
        requestStatus={program.latestRequestStatus}
        activeTab={tab}
        onTabChange={setTab}
        onSave={() => void saveDraft()}
        saving={saving}
        hasChanges={isDirty}
        primaryAction={primaryAction}
        onPrimary={runPrimary}
        primaryPending={submitting || publishing}
      />

      <div
        className="shrink-0 border-b px-4 py-2.5"
        style={{
          borderColor: "var(--border)",
          background:
            banner.tone === "warning"
              ? "#fdf7ee"
              : banner.tone === "success"
                ? "#d6ecd8"
                : "var(--surface)",
        }}
      >
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <span className="font-semibold" style={{ color: "var(--ink)" }}>
            {banner.title}.
          </span>{" "}
          {banner.body}
        </p>
      </div>

      {saveMessage ? (
        <p
          className="shrink-0 border-b px-4 py-2 text-[13px]"
          style={{
            borderColor: "var(--border)",
            color: successMessage ? "var(--text-secondary)" : "#c4554d",
            background: "var(--surface)",
          }}
        >
          {saveMessage}
        </p>
      ) : null}

      {scoped ? (
        <div className="shrink-0 px-4 pt-3">
          <Callout tone="info" title="Assigned scope">
            You can view and edit{" "}
            {program.assignmentScope?.scopedModuleTitles.length
              ? program.assignmentScope.scopedModuleTitles.join(", ")
              : "selected modules"}{" "}
            in this program. Program settings and other modules stay with Admin.
          </Callout>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProgramSettings
            program={catalog}
            disabled={lockDetails}
            onChange={(patch) => {
              if (lockDetails) return;
              patchProgram({
                ...(patch.name !== undefined ? { name: patch.name } : null),
                ...(patch.description !== undefined ? { description: patch.description } : null),
                ...(patch.category !== undefined ? { category: patch.category } : null),
                ...(patch.type !== undefined ? { type: patch.type as EditorProgram["type"] } : null),
                ...(patch.access !== undefined
                  ? { access: patch.access as EditorProgram["access"] }
                  : null),
                ...(patch.recognition !== undefined
                  ? { recognition: patch.recognition as EditorProgram["recognition"] }
                  : null),
                ...(patch.learningPath !== undefined
                  ? { learningPath: patch.learningPath as EditorProgram["learningPath"] }
                  : null),
                ...(patch.credentialValidity !== undefined
                  ? {
                      credentialValidity:
                        patch.credentialValidity as EditorProgram["credentialValidity"],
                    }
                  : null),
                ...(patch.price !== undefined ? { price: patch.price } : null),
                ...(patch.coverImageUrl !== undefined ? { coverImageUrl: patch.coverImageUrl } : null),
                ...(patch.tagIds !== undefined ? { tagIds: patch.tagIds } : null),
              });
            }}
          />
          <InstructorCatalogFields
            price={program.price}
            prerequisiteProgramId={program.prerequisiteProgramId}
            prerequisites={program.prerequisites}
            disabled={lockDetails}
            onChange={patchProgram}
          />
        </div>
      ) : tab === "preview" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ProgramPreview program={catalog} requiresApproval />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div
            className="pa-no-scrollbar w-[268px] shrink-0 overflow-y-auto border-r"
            style={{ borderColor: "var(--border)", background: "var(--surface-soft, #f7f7f5)" }}
          >
            <ModuleTree
              modules={catalog.modules}
              selected={selected}
              onSelect={setSelected}
              onAddModule={
                canAddModules
                  ? (afterModuleId) => {
                      const result = addModule(catalog, afterModuleId);
                      applyCatalog(result.program, {
                        kind: "lesson",
                        moduleId: result.module.id,
                        lessonId: result.module.lessons[0]?.id ?? "",
                      });
                    }
                  : undefined
              }
              onAddLesson={
                canMutateStructure
                  ? (moduleId) => {
                      const result = addLesson(
                        catalog,
                        moduleId,
                        selected.kind === "lesson" && selected.moduleId === moduleId
                          ? selected.lessonId
                          : undefined,
                      );
                      applyCatalog(result.program, {
                        kind: "lesson",
                        moduleId,
                        lessonId: result.lesson.id,
                      });
                    }
                  : undefined
              }
              onRenameModule={
                canMutateStructure
                  ? (moduleId, title) => {
                      applyCatalog({
                        ...catalog,
                        modules: catalog.modules.map((module) =>
                          module.id === moduleId ? { ...module, title } : module,
                        ),
                      });
                    }
                  : undefined
              }
              onDeleteModule={
                canAddModules
                  ? (moduleId) => {
                      const module = catalog.modules.find((item) => item.id === moduleId);
                      if (!module) return;
                      setConfirm({
                        kind: "module",
                        moduleId,
                        title: module.title,
                        lessonCount: module.lessons.length,
                      });
                    }
                  : undefined
              }
              onDeleteLesson={
                canMutateStructure
                  ? (moduleId, lessonId) => {
                      const lesson = catalog.modules
                        .find((item) => item.id === moduleId)
                        ?.lessons.find((item) => item.id === lessonId);
                      if (!lesson) return;
                      setConfirm({ kind: "lesson", moduleId, lessonId, title: lesson.title });
                    }
                  : undefined
              }
              onMoveModule={
                canAddModules
                  ? (moduleId, direction) => applyCatalog(moveModule(catalog, moduleId, direction))
                  : undefined
              }
              onMoveLesson={
                canMutateStructure
                  ? (moduleId, lessonId, direction) =>
                      applyCatalog(moveLesson(catalog, moduleId, lessonId, direction))
                  : undefined
              }
            />
          </div>

          <ScrollPane
            as="main"
            resetKey={selected.kind === "lesson" ? selected.lessonId : "overview"}
            className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
            style={{ background: "var(--canvas, #f1f1ef)" }}
          >
            {selected.kind === "overview" ? (
              <OverviewPane
                program={catalog}
                busy={saving || submitting || publishing || lockDetails}
                onPatch={(patch) => {
                  if (lockDetails) return;
                  patchProgram({
                    ...(patch.name !== undefined ? { name: patch.name } : null),
                    ...(patch.description !== undefined ? { description: patch.description } : null),
                    ...(patch.coverImageUrl !== undefined
                      ? { coverImageUrl: patch.coverImageUrl }
                      : null),
                  });
                }}
                onCoverPersist={lockDetails ? undefined : persistCover}
                onSettings={() => setTab("settings")}
              />
            ) : activeLesson && activeModule ? (
              <LessonEditor
                key={activeLesson.id}
                lesson={activeLesson}
                programId={program.id}
                moduleTitle={activeModule.title}
                moduleIndex={catalog.modules.indexOf(activeModule)}
                lessonIndex={activeModule.lessons.indexOf(activeLesson)}
                disabled={locked}
                onChange={(patch) => {
                  if (locked) return;
                  applyCatalog({
                    ...catalog,
                    modules: catalog.modules.map((module) =>
                      module.id !== activeModule.id
                        ? module
                        : {
                            ...module,
                            lessons: module.lessons.map((lesson) =>
                              lesson.id === activeLesson.id ? { ...lesson, ...patch } : lesson,
                            ),
                          },
                    ),
                  });
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
        </div>
      )}

      {confirm ? (
        <ConfirmDialog
          title={
            confirm.kind === "submit"
              ? "Submit for approval?"
              : confirm.kind === "publish"
                ? "Publish this program?"
                : confirm.kind === "withdraw"
                  ? "Save and withdraw approval?"
                  : confirm.kind === "module"
                    ? "Delete this module?"
                    : "Delete this lesson?"
          }
          body={
            confirm.kind === "submit"
              ? `"${program.name.trim() || "This program"}" will go to an Academy Admin. You cannot publish it until they approve.`
              : confirm.kind === "publish"
                ? `"${program.name.trim() || "This program"}" will appear in Explore. Learners can enroll once it is live.`
                : confirm.kind === "withdraw"
                  ? "This program was approved. Saving new edits withdraws that approval. You will need to submit again."
                  : confirm.kind === "module"
                    ? `"${confirm.title}" and its ${confirm.lessonCount} lesson${confirm.lessonCount === 1 ? "" : "s"} will be removed.`
                    : `"${confirm.title}" and its quiz will be removed.`
          }
          confirmLabel={
            confirm.kind === "submit"
              ? "Submit"
              : confirm.kind === "publish"
                ? "Publish"
                : confirm.kind === "withdraw"
                  ? "Save anyway"
                  : "Delete"
          }
          pendingLabel={
            confirm.kind === "submit"
              ? "Submitting…"
              : confirm.kind === "publish"
                ? "Publishing…"
                : confirm.kind === "withdraw"
                  ? "Saving…"
                  : "Deleting…"
          }
          destructive={confirm.kind === "module" || confirm.kind === "lesson"}
          pending={
            confirm.kind === "submit"
              ? submitting
              : confirm.kind === "publish"
                ? publishing
                : confirm.kind === "withdraw"
                  ? saving
                  : false
          }
          onConfirm={confirmAction}
          onClose={() => {
            if (saving || submitting || publishing) return;
            setConfirm(null);
          }}
        />
      ) : null}
    </div>
  );
}
