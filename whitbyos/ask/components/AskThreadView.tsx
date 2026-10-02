"use client";

import { useState, useTransition, type ReactNode } from "react";
import { continueAskChat } from "@/whitbyos/ask/actions";
import { AskComposer } from "@/whitbyos/ask/components/AskComposer";
import { AskLiveProvider } from "@/whitbyos/ask/components/AskLive";
import { AskThinking } from "@/whitbyos/ask/components/AskThinking";
import { AskThreadHeader } from "@/whitbyos/ask/components/AskThreadHeader";
import { AskTranscript } from "@/whitbyos/ask/components/AskTranscript";

/**
 * Open thread: follow-ups stay on the page with the asked bubble + thinking
 * dots, then the redirect lands the finished reply.
 *
 * Composer is always pinned under the transcript.
 */
export function AskThreadView({
  threadId,
  title,
  lastReplyId,
  justCreated = false,
  children,
}: {
  threadId: string;
  title: string;
  /** The newest reply in the transcript below, as the server rendered it. */
  lastReplyId: string | null;
  /** Arrived here from the redirect that just made this thread. */
  justCreated?: boolean;
  children: ReactNode;
}) {
  const [pendingAsked, setPendingAsked] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /*
   * Which reply, if any, is new to this page.
   *
   * Everything on screen when the thread opens was written before somebody
   * came to read it, so none of it types. After that, a newest reply with an
   * id nobody has seen is one the model has just written, and that one does.
   *
   * Held in state rather than worked out while rendering: the answer has to
   * stay the same for as long as the animation runs, and a value recomputed
   * on every render would stop it halfway.
   */
  const [failed, setFailed] = useState(false);

  /*
   * Worked out while rendering, not in an effect afterwards.
   *
   * An effect runs after the browser has painted, so setting the live id
   * there meant every reply appeared in full, was painted, and only then
   * collapsed to nothing and typed itself out — a flash on every single
   * answer. Adjusting state during render is the documented way to react to
   * a changed prop: React re-runs the component before anything reaches the
   * screen.
   *
   * `seenId` starts as whatever was already on screen, so none of it types.
   * On a thread that has just been created there is nothing to have been
   * seen — its one reply was written a second ago — so it starts empty and
   * that reply types, which is the whole point of the effect.
   */
  const [seenId, setSeenId] = useState<string | null>(justCreated ? null : lastReplyId);
  const [liveId, setLiveId] = useState<string | null>(null);

  if (lastReplyId !== seenId) {
    setSeenId(lastReplyId);
    setLiveId(lastReplyId);
  }

  return (
    <div className="ask-chat-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <AskThreadHeader threadId={threadId} title={title} />
      <AskTranscript>
        <div className="ask-feed">
          <div className="ask-column mx-auto flex w-full flex-col gap-5 px-6 pb-6 pt-10">
            <AskLiveProvider liveId={liveId}>{children}</AskLiveProvider>
            {pendingAsked ? (
              <>
                <div className="flex justify-end">
                  <div className="ask-asked">{pendingAsked}</div>
                </div>
                <AskThinking />
              </>
            ) : null}

            {failed ? (
              <p className="ask-reply-note" style={{ color: "var(--danger-fg)" }}>
                Something went wrong on the way to Whitby. Your message is
                saved — ask again and it will pick up where it left off.
              </p>
            ) : null}
          </div>
        </div>
      </AskTranscript>
      <div className="ask-composer-bar">
        <div className="ask-column mx-auto px-6">
          <AskComposer
            threadId={threadId}
            placeholder={pending ? "Whitby is working…" : "Ask a follow-up…"}
            busy={pending}
            onSend={(q, data) => {
              setFailed(false);
              /* Painted here rather than inside the transition: a state
                 change made inside one belongs to that transition and does
                 not reach the screen until it settles, which is the whole
                 ten seconds the model is thinking. */
              setPendingAsked(q);
              startTransition(async () => {
                try {
                  await continueAskChat(data);
                } catch {
                  /* The question is already written to the thread, so it is
                     not lost — what would be lost is the screen. */
                  setFailed(true);
                } finally {
                  /* The action revalidates rather than redirects now, so this
                     component is not remounted and has to drop its own copy
                     of the question — the real one has arrived in `children`.
                     In `finally`, because a model that times out used to
                     leave the question sitting under thinking dots that never
                     stopped, with a composer that worked and no way to tell
                     anything had gone wrong. */
                  setPendingAsked(null);
                }
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
