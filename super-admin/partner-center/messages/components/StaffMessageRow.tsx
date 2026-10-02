import { cn } from "@/base/lib/cn";
import { MessageReceiptTicks } from "@/partner-center/messages/components/MessageReceiptTicks";
import { clockTime } from "@/partner-center/messages/lib/format";
import type { MessageReadStatus } from "@/partner-center/messages/lib/read-status";
import type { AdminThreadMessage } from "@/super-admin/partner-center/messages/types";

type Shown = AdminThreadMessage & { pending?: boolean };

export function StaffMessageRow({
  message,
  opens,
}: {
  message: Shown;
  opens: boolean;
}) {
  const mine = message.isStaff;
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
              className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[10.5px] font-bold"
              style={{
                background: "var(--avatar-tan-bg)",
                color: "var(--avatar-tan-fg)",
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
            : { background: "var(--chat-them)", color: "var(--chat-ink)" }
        }
      >
        {opens && !mine ? (
          <div
            className="mb-0.5 text-[12.5px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            {message.authorName}
          </div>
        ) : null}

        <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.5]">
          {message.body}
        </div>

        <div
          className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] leading-none"
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
