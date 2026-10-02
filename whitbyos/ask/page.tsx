import { redirect } from "next/navigation";
import { startAskChat } from "@/whitbyos/ask/actions";
import { AskLanding } from "@/whitbyos/ask/components/AskLanding";
import { AskRail } from "@/whitbyos/ask/components/AskRail";
import { AskReply } from "@/whitbyos/ask/components/AskReply";
import { AskReplyTyped } from "@/whitbyos/ask/components/AskReplyTyped";
import { AskMark } from "@/whitbyos/ask/components/AskThinking";
import { AskThreadView } from "@/whitbyos/ask/components/AskThreadView";
import { getAskThread, listAskThreads } from "@/whitbyos/lib/ask-threads";

/**
 * Screen 1.0c — Ask Whitby Anything.
 *
 * A chat, not a one-shot search. History in a collapsible rail like a chat
 * client, the conversation scrolling on its own, Home still posting the first
 * question here.
 */
export default async function AskPage({
  threadId,
  searchParams,
}: {
  threadId?: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const incoming = one(searchParams?.q)?.trim() ?? "";

  // Deep link from Home still works; landing cards no longer use ?q=.
  if (incoming && !threadId) {
    const data = new FormData();
    data.set("q", incoming);
    await startAskChat(data);
  }

  const threads = await listAskThreads();
  const open = threadId ? await getAskThread(threadId) : null;
  if (threadId && !open) redirect("/whitbyos/ask");

  const lastWhitbyId =
    open?.messages
      .slice()
      .reverse()
      .find((row) => row.role === "whitby")?.id ?? null;

  return (
    <div data-ask-shell className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <AskRail threads={threads} threadId={threadId} />

      <div
        className="ask-chat-pane flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {open ? (
          <AskThreadView
            /* Every Whitby screen is one catch-all route, so moving between
               threads in the rail is a prop change, not a navigation: without
               a key React keeps this component — and the reply it had already
               marked as seen — and the next thread's old answer types itself
               out. The key makes a different thread a different component. */
            key={open.thread.id}
            threadId={open.thread.id}
            /* Straight off the redirect that created this thread. */
            justCreated={one(searchParams?.new) === "1"}
            title={open.thread.title}
            lastReplyId={lastWhitbyId}
          >
            {open.messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  {message.imageUrl ? (
                    <div className="max-w-[85%]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={message.imageUrl}
                        alt=""
                        className="mb-2 max-h-[220px] rounded-control object-cover"
                      />
                      <div className="ask-asked">{message.body}</div>
                    </div>
                  ) : (
                    <div className="ask-asked">{message.body}</div>
                  )}
                </div>
              ) : (
                <div key={message.id} className="ask-turn">
                  <AskMark />
                  <div className="ask-turn-body">
                    {message.answer ? (
                      message.id === lastWhitbyId ? (
                        <AskReplyTyped id={message.id} answer={message.answer} />
                      ) : (
                        <AskReply answer={message.answer} />
                      )
                    ) : (
                      <p className="ask-reply-note">{message.body}</p>
                    )}
                  </div>
                </div>
              ),
            )}
          </AskThreadView>
        ) : (
          <AskLanding />
        )}
      </div>
    </div>
  );
}
