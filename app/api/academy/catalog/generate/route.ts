import { getSessionProfile } from "@/base/identity/session";
import { createClient } from "@/base/lib/supabase/server";
import {
  canAccessAdminArea,
  canAccessInstructorArea,
  canCreateCatalogProgram,
  canCreateProgram,
  isInstructor,
} from "@/academy/lib/authorization";
import type { CatalogPipelineEvent } from "@/academy/admin/catalog/lib/stages";
import { persistGeneratedCatalog } from "@/academy/admin/services/persistGeneratedCatalog";
import { rewriteProgramDraft } from "@/academy/admin/services/catalogPersistence";
import { describeDeepSeekError } from "@/academy/admin/services/catalogPipeline/deepseek";
import { runCatalogPipeline, toPersistedDraft } from "@/academy/admin/services/catalogPipeline/pipeline";
import { courseBodiesAreComplete } from "@/academy/admin/services/catalogPipeline/quality";
import { normalizeDifficulty } from "@/academy/admin/services/catalogPipeline/prompts";
import { toDbProgramType } from "@/academy/lib/courseMetadata";
import { COURSE_TAG_MIN } from "@/academy/lib/courseTags/constants";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
/** Vercel Pro max; pipeline soft-deadline leaves headroom to persist before kill. */
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const profile = await getSessionProfile();
  if (!profile) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json(
      { error: "DEEPSEEK_API_KEY is not configured. Add it to .env.local and restart the server." },
      { status: 503 },
    );
  }

  let body: {
    prompt?: string;
    length?: string;
    difficulty?: string;
    type?: string;
    surface?: string;
    tagIds?: string[];
    attachments?: { name: string; content: string; kind?: string; pageCount?: number }[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const surface = body.surface === "instructor" ? "instructor" : "admin";
  const actor = { id: profile.user.id };
  if (surface === "instructor") {
    const [area, instructor, allowed] = await Promise.all([
      canAccessInstructorArea(actor),
      isInstructor(actor),
      canCreateProgram(actor),
    ]);
    if (!area || !instructor || !allowed) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // TEMPORARY — Brent helper account AI/course cap (remove with tempInstructorQuota).
    const { checkTempInstructorCourseQuota } = await import(
      "@/academy/lib/tempInstructorQuota"
    );
    const quota = await checkTempInstructorCourseQuota({
      userId: profile.user.id,
      email: profile.user.email,
    });
    if (quota.limited && !quota.allowed) {
      return Response.json({ error: quota.message }, { status: 403 });
    }
  } else {
    const [area, canCreate] = await Promise.all([
      canAccessAdminArea(actor),
      canCreateCatalogProgram(actor),
    ]);
    if (!area || !canCreate) {
      return Response.json(
        {
          error:
            "Academy Admins create programs with Whitby. Super Admin manages people, approvals, and settings.",
        },
        { status: 403 },
      );
    }
  }

  const attachments = Array.isArray(body.attachments)
    ? body.attachments
        .filter(
          (item) =>
            item &&
            typeof item.name === "string" &&
            typeof item.content === "string" &&
            item.name.trim() &&
            item.content.trim() &&
            !item.content.includes("[PDF attached:"),
        )
        .slice(0, 5)
        .map((item) => ({
          name: item.name.trim().slice(0, 200),
          content: item.content.trim().slice(0, 120_000),
          kind: typeof item.kind === "string" ? item.kind.slice(0, 16) : undefined,
          pageCount: typeof item.pageCount === "number" ? item.pageCount : undefined,
        }))
    : undefined;

  const prompt =
    body.prompt?.trim() ||
    (attachments?.length ? "Create a course from the attached document." : "");
  if (!prompt) {
    return Response.json({ error: "Add a prompt or attach a source document before generating." }, { status: 400 });
  }

  const length = typeof body.length === "string" ? body.length.trim() : "";
  const difficulty = typeof body.difficulty === "string" ? body.difficulty.trim() : "";
  const typeRaw = typeof body.type === "string" ? body.type.trim() : "";
  if (!length || !difficulty || !typeRaw) {
    return Response.json(
      { error: "Select type (Free or Paid), length, and difficulty before generating." },
      { status: 400 },
    );
  }

  const tagIds = Array.isArray(body.tagIds)
    ? [...new Set(body.tagIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean))].slice(
        0,
        3,
      )
    : [];
  if (tagIds.length < COURSE_TAG_MIN) {
    return Response.json(
      { error: `Select ${COURSE_TAG_MIN} course tags before generating.` },
      { status: 400 },
    );
  }

  // Whitby Type box is Free/Paid. Program kind defaults to Course — set in Settings after.
  const pricingKey = typeRaw.toLowerCase();
  const accessOverride =
    pricingKey === "paid" || pricingKey === "purchased"
      ? ("purchased" as const)
      : pricingKey === "free"
        ? ("free" as const)
        : undefined;
  const programType = accessOverride ? "course" : toDbProgramType(typeRaw);

  const input = {
    prompt,
    length,
    difficulty,
    type: programType,
    attachments,
  };

  const encoder = new TextEncoder();
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      let closed = false;
      const send = (event: CatalogPipelineEvent) => {
        if (closed) return;
        try {
          streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const heartbeat = setInterval(() => {
        if (!closed) {
          try {
            streamController.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            closed = true;
          }
        }
      }, 15_000);

      const startedAt = Date.now();
      // Soft deadline inside the 300s Vercel window so we can still save.
      const deadlineAt = startedAt + 270_000;
      const checkpointRef: {
        current: { programId: string; programName: string } | null;
      } = { current: null };

      try {
        const course = await runCatalogPipeline(input, send, controller.signal, {
          deadlineAt,
          onBodiesReady: async (partial) => {
            if (checkpointRef.current) return;
            send({
              type: "stage",
              stage: "quizzes",
              status: "active",
              detail: "Saving progress…",
              progress: 0.02,
            });
            const draft = toPersistedDraft(partial, input.type);
            const supabase = await createClient();
            const persisted = await persistGeneratedCatalog({
              supabase,
              userId: profile.user.id,
              surface,
              draft,
              prompt,
              requestType: input.type,
              access: accessOverride,
            });
            if (!persisted.ok) {
              console.error("[api/academy/catalog/generate] checkpoint", persisted.message);
              throw new Error(
                persisted.message ||
                  "Whitby could not save progress. Generate again — nothing was kept.",
              );
            }
            const { setProgramTags } = await import("@/academy/lib/courseTags/services");
            const tags = await setProgramTags(persisted.programId, tagIds);
            if (!tags.ok) {
              console.error("[api/academy/catalog/generate] checkpoint tags", tags.message);
            }
            checkpointRef.current = {
              programId: persisted.programId,
              programName: draft.name.trim() || "Untitled program",
            };
            send({
              type: "checkpoint",
              programId: persisted.programId,
              programName: checkpointRef.current.programName,
            });
          },
        });

        const checkpoint = checkpointRef.current;

        if (!courseBodiesAreComplete(course, normalizeDifficulty(input.difficulty))) {
          if (checkpoint) {
            send({
              type: "stage",
              stage: "quality",
              status: "done",
              detail: "Draft saved",
              progress: 1,
            });
            send({
              type: "done",
              programId: checkpoint.programId,
              programName: checkpoint.programName,
              elapsedMs: Date.now() - startedAt,
            });
            return;
          }
          send({
            type: "error",
            message:
              "Whitby finished the outline but not every lesson body. Incomplete courses are not saved — generate again.",
            code: "incomplete_course",
          });
          return;
        }

        send({
          type: "stage",
          stage: "quality",
          status: "active",
          detail: checkpoint ? "Updating draft with quizzes…" : "Saving draft…",
          progress: 0.55,
        });
        const draft = toPersistedDraft(course, input.type);
        const supabase = await createClient();

        if (checkpoint) {
          const rewritten = await rewriteProgramDraft(supabase, checkpoint.programId, {
            ...draft,
            name: draft.name.trim() || checkpoint.programName,
          });
          if (!rewritten.ok) {
            // Bodies already saved — open the draft; quizzes may still be missing.
            send({
              type: "stage",
              stage: "quality",
              status: "done",
              detail: "Lessons saved — finish quizzes in the builder if needed",
              progress: 1,
            });
            send({
              type: "done",
              programId: checkpoint.programId,
              programName: checkpoint.programName,
              elapsedMs: Date.now() - startedAt,
            });
            return;
          }
          send({
            type: "stage",
            stage: "quality",
            status: "done",
            detail: "Saved",
            progress: 1,
          });
          send({
            type: "done",
            programId: checkpoint.programId,
            programName: draft.name.trim() || checkpoint.programName,
            elapsedMs: Date.now() - startedAt,
          });
          return;
        }

        const persisted = await persistGeneratedCatalog({
          supabase,
          userId: profile.user.id,
          surface,
          draft,
          prompt,
          requestType: input.type,
          access: accessOverride,
        });
        if (!persisted.ok) {
          send({
            type: "stage",
            stage: "quality",
            status: "failed",
            detail: "Could not save draft",
          });
          send({
            type: "error",
            message: persisted.message,
            code: "persist_failed",
          });
          return;
        }

        const { setProgramTags } = await import("@/academy/lib/courseTags/services");
        const tags = await setProgramTags(persisted.programId, tagIds);
        // Draft is already saved — never error here (avoids duplicate retries).
        send({
          type: "stage",
          stage: "quality",
          status: "done",
          detail: tags.ok ? "Saved" : "Saved — set tags in Settings",
          progress: 1,
        });
        send({
          type: "done",
          programId: persisted.programId,
          programName: draft.name.trim() || "Untitled program",
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        console.error("[api/academy/catalog/generate]", error);
        // If bodies were checkpointed, never strand the admin — open the draft.
        const checkpoint = checkpointRef.current;
        if (checkpoint) {
          send({
            type: "stage",
            stage: "quality",
            status: "done",
            detail: "Draft saved — open the builder to finish",
            progress: 1,
          });
          send({
            type: "done",
            programId: checkpoint.programId,
            programName: checkpoint.programName,
            elapsedMs: Date.now() - startedAt,
          });
          return;
        }
        send({
          type: "stage",
          stage: "quality",
          status: "failed",
          detail: "Stopped",
        });
        send({
          type: "error",
          message: describeDeepSeekError(error).message,
          code: "generation_failed",
        });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try {
          streamController.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
