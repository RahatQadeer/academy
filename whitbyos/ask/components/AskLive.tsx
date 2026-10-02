"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Which reply, if any, arrived just now.
 *
 * The typewriter is drawn on the last thing Whitby said, which is right
 * while it is being said and wrong every other time: opening a thread from
 * the rail, or refreshing, replayed an answer from last Tuesday letter by
 * letter as though the model were writing it again.
 *
 * An id rather than a flag, because "something was asked from this page" is
 * not the same question. While the model is thinking, the last reply on
 * screen is still the *previous* one — a flag would set it typing itself out
 * again during the wait, which is the same fault wearing a different hat.
 * Only the message that was not there before types.
 *
 * Null by default, so anything rendered outside a live thread shows whole.
 */
const AskLive = createContext<string | null>(null);

export function AskLiveProvider({
  liveId,
  children,
}: {
  liveId: string | null;
  children: ReactNode;
}) {
  return <AskLive.Provider value={liveId}>{children}</AskLive.Provider>;
}

/** True only for the reply that arrived while this page was open. */
export function useAskLive(id: string) {
  return useContext(AskLive) === id;
}
