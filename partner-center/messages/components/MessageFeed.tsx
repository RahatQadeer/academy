import { ScrollToLatest } from "@/partner-center/messages/components/ScrollToLatest";
import { dayLabel, dayOf } from "@/partner-center/messages/lib/format";
import { pcType } from "@/partner-center/lib/typography";
import { cn } from "@/base/lib/cn";
import type { PartnerMessage } from "@/partner-center/messages/types";
import { MessageRow } from "@/partner-center/messages/components/MessageRow";

type Shown = PartnerMessage & { pending?: boolean };

const RUN_MS = 5 * 60 * 1000;

export function MessageFeed({
  messages,
  threadId,
}: {
  messages: Shown[];
  threadId: string;
}) {
  return (
    <div
      data-message-feed
      className="flex min-h-0 flex-1 flex-col overflow-auto px-7 py-6"
    >
      <div className="mt-auto">
        {messages.length === 0 ? (
          <p className={cn(pcType.body)} style={{ color: "var(--chat-muted)" }}>
            Nothing sent yet.
          </p>
        ) : (
          messages.map((message, index) => {
            const before = index > 0 ? messages[index - 1] : null;
            const runs =
              before !== null &&
              before.isMine === message.isMine &&
              before.authorName === message.authorName &&
              new Date(message.sentAt).getTime() -
                new Date(before.sentAt).getTime() <
                RUN_MS;
            const newDay = !before || dayOf(before.sentAt) !== dayOf(message.sentAt);
            const opens = newDay || !runs;

            return (
              <div key={message.id}>
                {newDay ? (
                  <div className="my-3.5 flex justify-center">
                    <span
                      className={cn(
                        "rounded-[6px] px-2.5 py-1 font-medium",
                        pcType.micro,
                      )}
                      style={{
                        background: "var(--chat-panel)",
                        color: "var(--chat-muted)",
                      }}
                    >
                      {dayLabel(message.sentAt)}
                    </span>
                  </div>
                ) : null}
                <div className={message.pending ? "opacity-70" : undefined}>
                  <MessageRow message={message} opens={opens} />
                </div>
              </div>
            );
          })
        )}
        <ScrollToLatest threadId={threadId} count={messages.length} />
      </div>
    </div>
  );
}
