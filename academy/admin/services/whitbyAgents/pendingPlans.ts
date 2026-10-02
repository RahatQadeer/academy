import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { deflateSync, inflateSync } from "zlib";
import type { PersistedProgramDraft } from "../catalogPersistence";
import type { RiskAssessment } from "./risk";

/**
 * Pending Whitby plans must survive Vercel’s multi-instance serverless
 * runtime. We keep an in-memory cache for same-instance Apply, and also
 * seal the plan into a signed, compressed payload the client echoes back
 * so Apply works on any instance.
 */

export type PreviewDraft = PersistedProgramDraft & { summary: string; mutated?: boolean };

export type PendingPlan = {
  token: string;
  programId: string;
  userId: string;
  draft: PreviewDraft;
  fallbackCategory: string;
  steps: string[];
  risk: RiskAssessment;
  expires: number;
};

type SealedBody = {
  token: string;
  programId: string;
  userId: string;
  draft: PreviewDraft;
  fallbackCategory: string;
  steps: string[];
  risk: RiskAssessment;
  exp: number;
};

const store = new Map<string, PendingPlan>();
const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 500;

function signingKey() {
  return (
    process.env.WHITBY_PLAN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    "local-whitby-plan-dev-key"
  );
}

function sweep(now: number): void {
  for (const [key, plan] of store) {
    if (plan.expires <= now) store.delete(key);
  }
}

function sign(body: string) {
  return createHmac("sha256", signingKey()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Compress + HMAC so the client can carry the plan across serverless instances. */
export function sealPendingPlan(plan: PendingPlan): string {
  const payload: SealedBody = {
    token: plan.token,
    programId: plan.programId,
    userId: plan.userId,
    draft: plan.draft,
    fallbackCategory: plan.fallbackCategory,
    steps: plan.steps,
    risk: plan.risk,
    exp: plan.expires,
  };
  const compressed = deflateSync(Buffer.from(JSON.stringify(payload), "utf8")).toString("base64url");
  return `${compressed}.${sign(compressed)}`;
}

export function unsealPendingPlan(
  sealed: string,
  programId: string,
  userId: string,
): PendingPlan | null {
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) return null;
  const compressed = sealed.slice(0, dot);
  const signature = sealed.slice(dot + 1);
  if (!compressed || !signature || !safeEqual(sign(compressed), signature)) return null;

  try {
    const json = inflateSync(Buffer.from(compressed, "base64url")).toString("utf8");
    const body = JSON.parse(json) as SealedBody;
    if (!body?.token || !body.draft || !body.programId || !body.userId) return null;
    if (body.programId !== programId || body.userId !== userId) return null;
    if (typeof body.exp !== "number" || body.exp <= Date.now()) return null;
    return {
      token: body.token,
      programId: body.programId,
      userId: body.userId,
      draft: body.draft,
      fallbackCategory: body.fallbackCategory ?? "",
      steps: Array.isArray(body.steps) ? body.steps : [],
      risk: body.risk,
      expires: body.exp,
    };
  } catch {
    return null;
  }
}

export function stashPlan(plan: Omit<PendingPlan, "expires">): { token: string; payload: string } {
  const now = Date.now();
  if (store.size >= MAX_ENTRIES) sweep(now);
  const full: PendingPlan = { ...plan, expires: now + TTL_MS };
  store.set(plan.token, full);
  return { token: plan.token, payload: sealPendingPlan(full) };
}

/**
 * Resolve a pending plan from same-instance memory, or from the sealed
 * client payload when Apply lands on a different Vercel instance.
 * Sealed payloads can be retried if persist fails; memory entries are one-shot.
 */
export function takePlan(
  token: string,
  programId: string,
  userId: string,
  sealedPayload?: string | null,
): PendingPlan | null {
  const now = Date.now();
  sweep(now);

  let plan = store.get(token) ?? null;
  if (plan) {
    store.delete(token);
    if (plan.expires <= now) plan = null;
    else if (plan.programId !== programId || plan.userId !== userId) plan = null;
  }

  if (!plan && sealedPayload) {
    plan = unsealPendingPlan(sealedPayload, programId, userId);
    if (plan && plan.token !== token) plan = null;
  }

  return plan;
}
