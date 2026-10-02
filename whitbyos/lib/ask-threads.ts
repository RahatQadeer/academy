import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { askThreadLabel } from "@/whitbyos/lib/ask-format";
import type { Answer } from "@/whitbyos/lib/ask";

export type AskThreadRow = {
  id: string;
  title: string;
  updatedAt: string;
};

export type AskMessageRow = {
  id: string;
  role: "user" | "whitby";
  body: string;
  answer: Answer | null;
  imageUrl: string | null;
  createdAt: string;
};

type LiveThread = {
  userId: string;
  workspaceId: string;
  thread: AskThreadRow;
  messages: AskMessageRow[];
};

const globalForAsk = globalThis as typeof globalThis & {
  __whitbyAskLive?: Map<string, LiveThread>;
};
const liveThreads = globalForAsk.__whitbyAskLive ?? new Map<string, LiveThread>();
globalForAsk.__whitbyAskLive = liveThreads;

async function mine() {
  const profile = await getSessionProfile();
  const workspaceId = await getCurrentWorkspaceId();
  if (!profile?.user.id || !workspaceId) return null;
  return { userId: profile.user.id, workspaceId, supabase: await createClient() };
}

function titleFrom(question: string) {
  const titled = askThreadLabel(question);
  if (titled === "New chat") return titled;
  return titled.length > 42 ? `${titled.slice(0, 41).trim()}...` : titled;
}

function liveFor(userId: string, workspaceId: string) {
  return [...liveThreads.values()].filter(
    (row) => row.userId === userId && row.workspaceId === workspaceId,
  );
}

function rememberLive(ctx: { userId: string; workspaceId: string }, question: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  liveThreads.set(id, {
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    thread: { id, title: titleFrom(question), updatedAt: now },
    messages: [],
  });
  return id;
}

export async function listAskThreads(): Promise<AskThreadRow[]> {
  const ctx = await mine();
  if (!ctx) return [];

  /*
   * The rail follows the workspace somebody is in.
   *
   * A thread's title is written from the question that started it, so the
   * history read like "Okonkwo visa timeline" — other clients' names, in a
   * list, inside a different client's workspace. `client_id` has been
   * written on every thread since they were introduced and was simply never
   * read back. Threads started with no client open belong to the firm and
   * stay, since they were never about anybody in particular.
   */
  const openClient = await getOpenClientId();

  let query = ctx.supabase
    .from("whitbyos_ask_threads")
    .select("id, title, updated_at")
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId);

  if (openClient) query = query.or(`client_id.eq.${openClient},client_id.is.null`);

  const { data } = await query.order("updated_at", { ascending: false }).limit(40);

  const fromDb = (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    updatedAt: row.updated_at as string,
  }));
  const seen = new Set(fromDb.map((row) => row.id));
  const fromLive = liveFor(ctx.userId, ctx.workspaceId)
    .map((row) => row.thread)
    .filter((row) => !seen.has(row.id));

  return [...fromDb, ...fromLive].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function getAskThread(threadId: string): Promise<{
  thread: AskThreadRow;
  messages: AskMessageRow[];
} | null> {
  const ctx = await mine();
  if (!ctx) return null;

  const live = liveThreads.get(threadId);
  if (live && live.userId === ctx.userId && live.workspaceId === ctx.workspaceId) {
    return { thread: live.thread, messages: live.messages };
  }

  const { data: thread } = await ctx.supabase
    .from("whitbyos_ask_threads")
    .select("id, title, updated_at")
    .eq("id", threadId)
    .eq("workspace_id", ctx.workspaceId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (!thread) return null;

  const { data: rows } = await ctx.supabase
    .from("whitbyos_ask_messages")
    .select("id, role, body, answer, image_path, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const messages: AskMessageRow[] = [];
  for (const row of rows ?? []) {
    let imageUrl: string | null = null;
    const path = row.image_path as string | null;
    if (path) {
      const { data: signed } = await ctx.supabase.storage
        .from("documents")
        .createSignedUrl(path, 60 * 60);
      imageUrl = signed?.signedUrl ?? null;
    }
    messages.push({
      id: row.id as string,
      role: row.role === "whitby" ? "whitby" : "user",
      body: (row.body as string) ?? "",
      answer: (row.answer as Answer | null) ?? null,
      imageUrl,
      createdAt: row.created_at as string,
    });
  }

  return {
    thread: {
      id: thread.id as string,
      title: thread.title as string,
      updatedAt: thread.updated_at as string,
    },
    messages,
  };
}

export async function createAskThread(question: string) {
  const ctx = await mine();
  if (!ctx) return null;

  const clientId = await getOpenClientId();
  const { data, error } = await ctx.supabase
    .from("whitbyos_ask_threads")
    .insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      title: titleFrom(question),
      client_id: clientId,
    })
    .select("id")
    .single();

  if (!error && data) return data.id as string;
  return rememberLive(ctx, question);
}

export async function addAskMessage({
  threadId,
  role,
  body,
  answer,
  imagePath,
  imageUrl,
}: {
  threadId: string;
  role: "user" | "whitby";
  body: string;
  answer?: Answer | null;
  imagePath?: string | null;
  imageUrl?: string | null;
}) {
  const ctx = await mine();
  if (!ctx) return { ok: false as const, error: "Not signed in." };

  const live = liveThreads.get(threadId);
  if (live && live.userId === ctx.userId) {
    const now = new Date().toISOString();
    live.messages.push({
      id: crypto.randomUUID(),
      role,
      body,
      answer: answer ?? null,
      imageUrl: imageUrl ?? null,
      createdAt: now,
    });
    live.thread.updatedAt = now;
    return { ok: true as const };
  }

  const { error } = await ctx.supabase.from("whitbyos_ask_messages").insert({
    thread_id: threadId,
    role,
    body,
    answer: answer ?? null,
    image_path: imagePath ?? null,
  });
  if (error) {
    const fallback = liveThreads.get(threadId) ?? {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      thread: { id: threadId, title: titleFrom(body), updatedAt: new Date().toISOString() },
      messages: [] as AskMessageRow[],
    };
    liveThreads.set(threadId, fallback);
    const now = new Date().toISOString();
    fallback.messages.push({
      id: crypto.randomUUID(),
      role,
      body,
      answer: answer ?? null,
      imageUrl: imageUrl ?? null,
      createdAt: now,
    });
    fallback.thread.updatedAt = now;
    return { ok: true as const };
  }

  await ctx.supabase
    .from("whitbyos_ask_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("user_id", ctx.userId);

  return { ok: true as const };
}

/** Keep the Ask chat with the client workspace it just created or filed under. */
export async function setAskThreadClient(threadId: string, clientId: string | null) {
  const ctx = await mine();
  if (!ctx) return { ok: false as const };

  const live = liveThreads.get(threadId);
  if (live && live.userId === ctx.userId && live.workspaceId === ctx.workspaceId) {
    // Live threads have no client_id field on the in-memory row; DB is source.
  }

  const { error } = await ctx.supabase
    .from("whitbyos_ask_threads")
    .update({ client_id: clientId, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("user_id", ctx.userId);

  return { ok: !error };
}

export async function renameAskThreadRow(threadId: string, title: string) {
  const ctx = await mine();
  if (!ctx) return { ok: false as const, error: "Not signed in." };

  const next = title.trim().slice(0, 80);
  if (!next) return { ok: false as const, error: "Give the chat a name." };

  const live = liveThreads.get(threadId);
  if (live && live.userId === ctx.userId && live.workspaceId === ctx.workspaceId) {
    live.thread.title = next;
    live.thread.updatedAt = new Date().toISOString();
  }

  const { error } = await ctx.supabase
    .from("whitbyos_ask_threads")
    .update({ title: next, updated_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("user_id", ctx.userId);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function deleteAskThreadRow(threadId: string) {
  const ctx = await mine();
  if (!ctx) return { ok: false as const };

  const live = liveThreads.get(threadId);
  if (live && live.userId === ctx.userId && live.workspaceId === ctx.workspaceId) {
    liveThreads.delete(threadId);
    return { ok: true as const };
  }

  const { data: files } = await ctx.supabase
    .from("whitbyos_ask_messages")
    .select("image_path")
    .eq("thread_id", threadId);

  const paths = (files ?? [])
    .map((row) => row.image_path as string | null)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    await ctx.supabase.storage.from("documents").remove(paths);
  }

  const { error } = await ctx.supabase
    .from("whitbyos_ask_threads")
    .delete()
    .eq("id", threadId)
    .eq("user_id", ctx.userId)
    .eq("workspace_id", ctx.workspaceId);

  return { ok: !error };
}

export async function storeAskImage(threadId: string, file: File) {
  const ctx = await mine();
  if (!ctx) return { error: "Not signed in." };

  if (!file.type.startsWith("image/")) {
    return { error: "Attach a PNG, JPG, GIF or WebP image." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { error: "That image is over 8MB. Choose a smaller one." };
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-80) || "image";
  const path = `${ctx.workspaceId}/ask/${threadId}/${Date.now()}-${safe}`;
  const { error } = await ctx.supabase.storage.from("documents").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { error: error.message };
  return { path };
}
