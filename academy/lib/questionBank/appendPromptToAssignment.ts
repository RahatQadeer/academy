import "server-only";

import { authorizeBankWrite } from "./authorizeWrite";
import { mergeAssignmentBrief } from "./mapAuthoring";
import { wrapBankBriefPrompt } from "./bankOrigin";
import type { AppendAssignmentPromptInput, AppendAssignmentPromptResult } from "./types";

const PROMPT_MAX = 8000;

export async function appendPromptToAssignment(
  input: AppendAssignmentPromptInput,
): Promise<AppendAssignmentPromptResult> {
  const prompts = (input.prompts?.length ? input.prompts : input.prompt ? [input.prompt] : [])
    .map((item) => wrapBankBriefPrompt(item.trim().slice(0, PROMPT_MAX)))
    .filter(Boolean);
  if (prompts.length === 0) {
    return { ok: false, reason: "invalid", message: "Write the assignment prompt first." };
  }

  const access = await authorizeBankWrite(input.programId, input.lessonId);
  if (!access.ok) {
    return { ok: false, reason: access.reason, message: access.message };
  }

  const { ctx } = access;
  if (ctx.lesson.type !== "assignment") {
    return {
      ok: false,
      reason: "no_assignment",
      message: "Pick an assignment lesson. Add one in the course builder if this course has none.",
    };
  }

  try {
    const { supabase, isAdmin, program } = ctx;
    const { data: rows, error } = await supabase
      .from("academy_assignments")
      .select("id, brief")
      .eq("lesson_id", ctx.lesson.id)
      .limit(1);
    if (error) return { ok: false, reason: "failed", message: "The assignment could not be loaded." };

    const existing = ((rows ?? [])[0] as { id: string; brief: string | null } | undefined) ?? null;
    if (!existing) {
      if (!isAdmin && program.status === "published") {
        return {
          ok: false,
          reason: "no_assignment",
          message: "This live course has no assignment record yet. An admin needs to add it in the catalog.",
        };
      }
      const { error: createError } = await supabase.from("academy_assignments").insert({
        lesson_id: ctx.lesson.id,
        brief: mergeAssignmentBrief("", prompts),
        submission_instructions: "",
        rubric: "",
        estimated_minutes: 45,
      });
      if (createError) {
        return { ok: false, reason: "failed", message: "The assignment could not be created for this lesson." };
      }
      return { ok: true };
    }

    const nextBrief = mergeAssignmentBrief(existing.brief ?? "", prompts);
    if (nextBrief === (existing.brief ?? "").trim()) {
      return { ok: true };
    }

    const { error: updateError } = await supabase
      .from("academy_assignments")
      .update({ brief: nextBrief })
      .eq("id", existing.id);
    if (updateError) {
      return { ok: false, reason: "failed", message: "The prompt could not be added to this assignment." };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed", message: "The prompt could not be added. Try again." };
  }
}
