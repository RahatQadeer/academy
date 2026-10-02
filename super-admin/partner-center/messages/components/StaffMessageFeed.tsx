import { ScrollToLatest } from "@/partner-center/messages/components/ScrollToLatest";
import { dayLabel, dayOf } from "@/partner-center/messages/lib/format";
import { StaffMessageRow } from "@/super-admin/partner-center/messages/components/StaffMessageRow";
import type { AdminThreadMessage } from "@/super-admin/partner-center/messages/types";

type Shown = AdminThreadMessage & { pending?: boolean };

const RUN_MS = 5 * 60 * 1000;

export function StaffMessageFeed({
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
          <p className="text-[13px]" style={{ color: "var(--chat-muted)" }}>
            Nothing sent yet. Write the opening message below — it appears in
            the partner&apos;s Messages tab.
          </p>
        ) : (
          messages.map((message, index) => {
            const before = index > 0 ? messages[index - 1] : null;
            const runs =
              before !== null &&
              before.isStaff === message.isStaff &&
              before.authorName === message.authorName &&
              new Date(message.sentAt).getTime() -
                new Date(before.sentAt).getTime() <
                RUN_MS;
            const newDay =
              !before || dayOf(before.sentAt) !== dayOf(message.sentAt);
            const opens = newDay || !runs;

            return (
              <div key={message.id}>
                {newDay ? (
                  <div className="my-3.5 flex justify-center">
                    <span
                      className="rounded-[6px] px-2.5 py-1 text-[11.5px] font-medium"
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
                  <StaffMessageRow message={message} opens={opens} />
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
