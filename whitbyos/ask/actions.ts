"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { askWhitby, formatAskReply, type Answer } from "@/whitbyos/lib/ask";
import {
  addAskMessage,
  createAskThread,
  deleteAskThreadRow,
  getAskThread,
  renameAskThreadRow,
  storeAskImage,
} from "@/whitbyos/lib/ask-threads";
import { getOpenClient } from "@/whitbyos/lib/open-client";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { isRawAskTitle, suggestAskThreadTitle } from "@/whitbyos/lib/ask-title";

function asFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

function bodyOf(answer: Answer) {
  return formatAskReply(answer);
}

async function attachImage(threadId: string, image: File | null) {
  if (!image) {
    return { path: null as string | null, preview: null as string | null, images: undefined };
  }

  const bytes = Buffer.from(await image.arrayBuffer());
  const data = bytes.toString("base64");
  const mimeType = image.type || "image/jpeg";
  const stored = await storeAskImage(threadId, image);

  return {
    path: "path" in stored ? stored.path : null,
    preview: `data:${mimeType};base64,${data}`,
    images: [{ mimeType, data }],
  };
}

/** Name the chat from what was asked (and who is open), for rail + header. */
async function nameAskThread(threadId: string, question: string, extras?: string[]) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return;
  const open = await getOpenClient();
  const title = await suggestAskThreadTitle({
    question,
    clientName: open?.name ?? null,
    workspaceId,
    extras,
  });
  await renameAskThreadRow(threadId, title);
}

export async function startAskChat(formData: FormData) {
  const question = String(formData.get("q") ?? "").trim();
  const image = asFile(formData.get("image"));
  if (!question && !image) redirect("/whitbyos/ask");

  const asked = question || "What is in this image?";
  const threadId = await createAskThread(asked);
  if (!threadId) redirect("/whitbyos/ask");

  const attached = await attachImage(threadId, image);
  await addAskMessage({
    threadId,
    role: "user",
    body: asked,
    imagePath: attached.path,
    imageUrl: attached.preview,
  });
  const answer = await askWhitby(asked, { images: attached.images, threadId });
  await addAskMessage({ threadId, role: "whitby", body: bodyOf(answer), answer });
  await nameAskThread(threadId, asked, answer.lead ? [answer.lead.slice(0, 200)] : undefined);
  /* `new=1` so the thread it lands on knows its one reply has just been
     written, and lets it type. Without it the first answer of every chat —
     the most genuinely new thing in the product — arrived fully formed. */
  redirect(`/whitbyos/ask/${threadId}?new=1`);
}

export async function continueAskChat(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "").trim();
  const question = String(formData.get("q") ?? "").trim();
  const image = asFile(formData.get("image"));
  if (!threadId) redirect("/whitbyos/ask");
  if (!question && !image) redirect(`/whitbyos/ask/${threadId}`);

  const asked = question || "What is in this image?";
  const existing = await getAskThread(threadId);
  if (!existing) redirect("/whitbyos/ask");

  const attached = await attachImage(threadId, image);
  await addAskMessage({
    threadId,
    role: "user",
    body: asked,
    imagePath: attached.path,
    imageUrl: attached.preview,
  });

  const prior = existing.messages.map((row) => ({
    role: row.role,
    body: row.role === "whitby" ? row.body.slice(0, 800) : row.body,
  }));

  /*
   * The last thing Whitby said, whatever it was — not the last thing it said
   * that happened to be a half-finished create.
   *
   * This searched for a message carrying a `pending`, which skips right over
   * the one that finished the job (it stores `pending: null`) and hands back
   * the create *before* it. So the turn after "Created the plan" arrived
   * still carrying the old intent and every old slot, the intent lock turned
   * the next ordinary question back into that create, and it wrote the row a
   * second time. Cancel had the same hole: the cancelled step was still the
   * newest one holding a pending, so it came straight back.
   */
  const lastWhitby = [...existing.messages].reverse().find((row) => row.role === "whitby");

  const answer = await askWhitby(asked, {
    prior,
    images: attached.images,
    pending: lastWhitby?.answer?.pending ?? null,
    threadId,
  });
  await addAskMessage({ threadId, role: "whitby", body: bodyOf(answer), answer });

  /*
   * If the rail still shows a raw starter ("Create a work plan…"), refine once
   * the thread has more context — e.g. a named plan for Rohail.
   */
  if (isRawAskTitle(existing.thread.title)) {
    const firstUser = existing.messages.find((row) => row.role === "user")?.body ?? asked;
    await nameAskThread(
      threadId,
      firstUser,
      [asked, answer.lead?.slice(0, 200) ?? ""].filter(Boolean),
    );
  }

  /*
   * Refreshed in place, not navigated to.
   *
   * This redirected to the thread it was already on. A redirect out of a
   * server action is a fresh navigation whatever the destination, so the
   * route's `loading.tsx` took the screen: the question and the thinking
   * dots the composer had just painted were replaced by a spinner over an
   * empty page, and the whole conversation came back only when the model
   * had finished. On a create that asks three questions that is a blank
   * screen three times.
   *
   * `revalidatePath` re-renders the server half underneath what is already
   * there. The asked bubble stays put and the reply appears under it.
   */
  revalidatePath("/[product]/[[...slug]]", "page");
}

/**
 * One turn of the panel that opens from the bar, on any screen.
 *
 * Neither of the two actions above fits it. `startAskChat` redirects to a
 * thread and `continueAskChat` revalidates the page underneath — both are
 * right for a screen that *is* the conversation, and wrong for a panel
 * sitting over the screen somebody is working on: the redirect would take
 * them off it, and the revalidation would redraw the thing they are looking
 * at on every message.
 *
 * So this one returns instead. The panel draws the reply itself, and the
 * page behind it is only refreshed when something was actually written.
 *
 * Same threads as the Ask page — same table, same rail — so a conversation
 * begun in the panel is in the history, and one begun on the page can be
 * carried on from the panel.
 */
function emptyAnswer(note: string): Answer {
  return { lead: "", sections: [], groups: [], open: null, note, pending: null };
}

export async function askInPanel(input: {
  threadId: string | null;
  question: string;
  /** The route the panel is open over, so Whitby knows where "here" is. */
  path: string;
}): Promise<{
  threadId: string | null;
  answer: Answer;
  /** Whether a row was written, so the panel knows to refresh the page. */
  changed: boolean;
}> {
  const asked = input.question.trim();
  if (!asked) {
    return { threadId: input.threadId, answer: emptyAnswer("Ask me something."), changed: false };
  }

  const threadId = input.threadId || (await createAskThread(asked));
  if (!threadId) {
    return {
      threadId: null,
      answer: emptyAnswer("Your session expired. Sign in and try again."),
      changed: false,
    };
  }

  const existing = await getAskThread(threadId);

  await addAskMessage({ threadId, role: "user", body: asked });

  const prior = (existing?.messages ?? []).map((row) => ({
    role: row.role,
    body: row.role === "whitby" ? row.body.slice(0, 800) : row.body,
  }));

  /* The last thing Whitby said, whatever it was — see `continueAskChat`. */
  const lastWhitby = [...(existing?.messages ?? [])].reverse().find((row) => row.role === "whitby");

  const answer = await askWhitby(asked, {
    prior,
    pending: lastWhitby?.answer?.pending ?? null,
    threadId,
    path: input.path,
  });

  await addAskMessage({ threadId, role: "whitby", body: bodyOf(answer), answer });

  if (!existing || existing.messages.length === 0) {
    await nameAskThread(threadId, asked, answer.lead ? [answer.lead.slice(0, 200)] : undefined);
  }

  /* An answer with somewhere to open is an answer that made something. */
  return { threadId, answer, changed: Boolean(answer.open) };
}

export async function deleteAskChat(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "").trim();
  if (threadId) await deleteAskThreadRow(threadId);
  revalidatePath("/[product]/[[...slug]]", "page");
}

/** Prefer this from the rail — no redirect, so the UI can remove the row instantly. */
export async function deleteAskThread(threadId: string) {
  const id = threadId.trim();
  if (id) await deleteAskThreadRow(id);
  revalidatePath("/[product]/[[...slug]]", "page");
}

export async function renameAskThread(threadId: string, title: string) {
  const result = await renameAskThreadRow(threadId, title);
  if (result.ok) revalidatePath("/[product]/[[...slug]]", "page");
  return result;
}
