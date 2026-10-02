import { cn } from "@/base/lib/cn";
import { MessageReceiptTicks } from "@/partner-center/messages/components/MessageReceiptTicks";
import { clockTime } from "@/partner-center/messages/lib/format";
import { pcType } from "@/partner-center/lib/typography";
import type { MessageReadStatus } from "@/partner-center/messages/lib/read-status";
import type { PartnerMessage } from "@/partner-center/messages/types";

type Shown = PartnerMessage & { pending?: boolean };

export function MessageRow({
  message,
  opens,
}: {
  message: Shown;
  /** First message in a run (or after a day break) — show face / open corner. */
  opens: boolean;
}) {
  const mine = message.isMine;
  const readStatus: MessageReadStatus = message.readStatus ?? "sent";

  return (
    <div
      className={cn(
        "flex items-end gap-2",
        opens ? "mt-3" : "mt-[2px]",
        mine && "flex-row-reverse",
      )}
    >
      {mine ? null : (
        <span className="w-6 shrink-0">
          {opens ? (
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center overflow-hidden rounded-full font-bold",
                pcType.micro,
              )}
              style={{
                background: "var(--avatar-blue-bg)",
                color: "var(--avatar-blue-fg)",
              }}
              title={message.authorName}
            >
              {message.authorInitials}
            </span>
          ) : null}
        </span>
      )}

      <div
        className={cn(
          "max-w-[min(62%,520px)] px-3 pb-[7px] pt-2 transition-opacity",
          mine
            ? opens
              ? "rounded-[10px] rounded-tr-[3px]"
              : "rounded-[10px]"
            : opens
              ? "rounded-[10px] rounded-tl-[3px]"
              : "rounded-[10px]",
          message.pending && "opacity-80",
        )}
        style={
          mine
            ? { background: "var(--accent)", color: "#fff" }
            : {
                background: "var(--chat-them)",
                color: "var(--chat-ink)",
                border: "1px solid var(--chat-line)",
              }
        }
      >
        {opens && !mine ? (
          <div
            className={cn("mb-0.5 font-semibold", pcType.label)}
            style={{ color: "var(--accent)" }}
          >
            {message.authorName}
          </div>
        ) : null}

        <div className={cn("whitespace-pre-wrap break-words leading-[1.5]", pcType.body)}>
          {message.body}
        </div>

        <div
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 leading-none",
            pcType.micro,
          )}
          style={{
            color: mine ? "rgba(255,255,255,.72)" : "var(--chat-faint)",
          }}
        >
          <span>{clockTime(message.sentAt)}</span>
          {mine ? <MessageReceiptTicks status={readStatus} onAccent /> : null}
        </div>
      </div>
    </div>
  );
}
