"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATALOG_STAGES, initialStageMap } from "@/academy/admin/catalog/lib/stages";
import {
  clearWhitbyBuilderAttachments,
  loadWhitbyBuilderAttachments,
} from "@/academy/admin/lib/whitbyBuilderAttachments";
import { COURSE_TAG_MIN } from "@/academy/lib/courseTags/constants";
import { streamPost } from "@/academy/lib/sse";
import { GeneratingProgram } from "./GeneratingProgram";

export function GeneratingProgramRunner({
  prompt,
  length,
  difficulty,
  type,
  tagIds = [],
  surface = "admin",
}: {
  prompt: string;
  length: string;
  difficulty: string;
  type: string;
  tagIds?: string[];
  surface?: "admin" | "instructor";
}) {
  const router = useRouter();
  const programsHref = surface === "instructor" ? "/academy/instructor/programs" : "/academy/admin/programs";
  const builderHref = (programId: string) =>
    surface === "instructor"
      ? `/academy/instructor/programs/${programId}`
      : `/academy/admin/catalog/${programId}`;
  const [runId, setRunId] = useState(0);
  const [stages, setStages] = useState(initialStageMap);
  const [skeleton, setSkeleton] = useState<{
    programName: string;
    modules: { title: string; lessons: { title: string; type: string }[] }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ programId: string; programName: string } | null>(
    null,
  );

  useEffect(() => {
    if (completed) return;
    if (!prompt.trim() || !length.trim() || !difficulty.trim() || !type.trim()) {
      setError("Select type (Free or Paid), length, and level before generating.");
      return;
    }
    if (tagIds.length < COURSE_TAG_MIN) {
      setError(`Select ${COURSE_TAG_MIN} course tags before generating.`);
      return;
    }
    const controller = new AbortController();
    let persistStarted = false;
    let checkpoint: { programId: string; programName: string } | null = null;

    function finishFromCheckpoint(saved: { programId: string; programName: string }) {
      clearWhitbyBuilderAttachments();
      setStages((current) => ({
        ...current,
        quizzes: {
          status: "done",
          detail: current.quizzes.status === "done" ? current.quizzes.detail : "Draft saved",
        },
        assessment: {
          status: "done",
          detail: current.assessment.status === "done" ? current.assessment.detail : "Review in builder",
        },
        quality: { status: "done", detail: "Saved", progress: 1 },
      }));
      setCompleted(saved);
    }

    streamPost(
      "/api/academy/catalog/generate",
      {
        prompt,
        length,
        difficulty,
        type,
        surface,
        tagIds,
        attachments: loadWhitbyBuilderAttachments(),
      },
      (event) => {
        if (event.type === "stage") {
          if (event.stage === "quality" || event.stage === "quizzes") persistStarted = true;
          setStages((current) => ({
            ...current,
            [event.stage]: {
              status: event.status,
              detail: event.detail,
              progress: event.progress,
            },
          }));
        } else if (event.type === "skeleton") {
          setSkeleton({ programName: event.programName, modules: event.modules });
        } else if (event.type === "checkpoint") {
          persistStarted = true;
          checkpoint = { programId: event.programId, programName: event.programName };
        } else if (event.type === "done") {
          persistStarted = true;
          clearWhitbyBuilderAttachments();
          // Always close the quality spinner when the draft is saved — the API
          // may send `done` without a trailing quality/done if the stream cuts.
          setStages((current) => ({
            ...current,
            quality: { status: "done", detail: "Saved", progress: 1 },
          }));
          setCompleted({ programId: event.programId, programName: event.programName });
        } else if (event.type === "error") {
          if (checkpoint) {
            finishFromCheckpoint(checkpoint);
            return;
          }
          setStages((current) => {
            const active = CATALOG_STAGES.find((stage) => current[stage.id].status === "active");
            if (!active) return current;
            return {
              ...current,
              [active.id]: { ...current[active.id], status: "failed", detail: "Stopped" },
            };
          });
          setError(event.message);
        }
      },
      controller.signal,
    ).catch((err) => {
      if (controller.signal.aborted) return;
      // Stream dropped after bodies were saved (common on Vercel time limits).
      if (checkpoint) {
        finishFromCheckpoint(checkpoint);
        return;
      }
      setError(err instanceof Error ? err.message : "Whitby could not generate the course draft.");
    });

    return () => {
      if (persistStarted) return;
      controller.abort();
    };
  }, [completed, difficulty, length, prompt, runId, surface, tagIds.join(","), type]);

  function retry() {
    setError(null);
    setCompleted(null);
    setSkeleton(null);
    setStages(initialStageMap());
    setRunId((current) => current + 1);
  }

  return (
    <GeneratingProgram
      programName={completed?.programName || skeleton?.programName || prompt || "New Program"}
      stages={stages}
      skeleton={skeleton}
      error={error}
      completed={completed}
      onCancel={() => router.replace(programsHref)}
      onRetry={retry}
      onOpenBuilder={
        completed ? () => router.replace(builderHref(completed.programId)) : undefined
      }
      onOpenPreview={
        completed
          ? () =>
              router.replace(
                surface === "instructor"
                  ? `${builderHref(completed.programId)}/preview`
                  : `${builderHref(completed.programId)}?tab=preview`,
              )
          : undefined
      }
    />
  );
}
