import type { MessageThread } from "@/client-portal/types";

/*
 * What the server page and the client rail both need.
 *
 * Its own module, not exported from `ThreadList.tsx`: that file is
 * "use client", and a function exported from one can only be rendered or
 * passed as a prop by the server — calling it there throws.
 */

const BASE = "/client-portal/messages";

export type RailTab = "conversations" | "unread" | "by-request";
export type RailKind = "direct" | "group";

/**
 * Whitby's own word for the conversation, rather than a count of who is on it.
 *
 * This used to be `participants.length > 1`, which disagrees with the other
 * side in both directions: a group of two people reads as a direct
 * conversation, and a direct conversation that a second professional joins
 * reads as a group. The column has said which since whitbyos/014.
 */
export function isGroup(thread: MessageThread) {
  return thread.kind === "group";
}

export function messagesHref(params: {
  kind?: RailKind;
  tab?: RailTab;
  thread?: string;
  q?: string;
  request?: string;
}) {
  const query = new URLSearchParams();
  if (params.kind === "group") query.set("kind", "group");
  if (params.tab && params.tab !== "conversations") query.set("tab", params.tab);
  if (params.request) query.set("request", params.request);
  if (params.thread) query.set("thread", params.thread);
  if (params.q) query.set("q", params.q);
  const rest = query.toString();
  return rest ? `${BASE}?${rest}` : BASE;
}
