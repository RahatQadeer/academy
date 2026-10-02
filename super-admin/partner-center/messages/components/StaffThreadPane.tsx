"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { staffDisplay } from "@/partner-center/messages/lib/format";
import { StaffMessageFeed } from "@/super-admin/partner-center/messages/components/StaffMessageFeed";
import { sendStaffMessageAction } from "@/super-admin/partner-center/messages/actions";
import type { AdminThreadMessage } from "@/super-admin/partner-center/messages/types";

type Shown = AdminThreadMessage & { pending?: boolean };

function sameBodyNearTime(a: string, aAt: string, b: string, bAt: string) {
  return (
    a === b && Math.abs(Date.parse(aAt) - Date.parse(bAt)) < 120_000
  );
}

function SendArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 13.5L14 8L2.5 2.5L2.5 6.9L10 8L2.5 9.1L2.5 13.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Instant bubble via local pending — does not wait on the server action. */
export function StaffThreadPane({
  profileId,
  messages,
  sendAction = sendStaffMessageAction,
}: {
  profileId: string;
  messages: AdminThreadMessage[];
  sendAction?: (input: {
    profileId: string;
    body: string;
  }) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Shown[]>([]);
  const staff = staffDisplay();
  const router = useRouter();
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const ready = body.trim().length > 0;

  useEffect(() => {
    setPending((current) => {
      if (current.length === 0) return current;
      const claimed = new Set<string>();
      return current.filter((item) => {
        const match = messages.find(
          (m) =>
            m.isStaff &&
            !claimed.has(m.id) &&
            sameBodyNearTime(m.body, m.sentAt, item.body, item.sentAt),
        );
        if (match) {
          claimed.add(match.id);
          return false;
        }
        return true;
      });
    });
  }, [messages]);

  useEffect(() => {
    const box = bodyInput.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${Math.min(box.scrollHeight, 108)}px`;
  }, [body]);

  const shown: Shown[] = useMemo(
    () => [...messages, ...pending],
    [messages, pending],
  );

  function handleSend() {
    setError(null);

    const trimmed = body.trim();
    if (!trimmed) {
      setError("Write a message before sending.");
      return;
    }

    const pendingId = `pending-${Date.now()}`;
    setBody("");
    setPending((current) => [
      ...current,
      {
        id: pendingId,
        senderType: "staff",
        authorName: staff.name,
        authorInitials: staff.initials,
        body: trimmed,
        sentAt: new Date().toISOString(),
        isStaff: true,
        readStatus: "sent",
        pending: true,
      },
    ]);

    void (async () => {
      const result = await sendAction({
        profileId,
        body: trimmed,
      });
      if (result.error) {
        setPending((current) => current.filter((item) => item.id !== pendingId));
        setError(result.error);
        setBody(trimmed);
        return;
      }

      setPending((current) =>
        current.map((item) =>
          item.id === pendingId ? { ...item, pending: false } : item,
        ),
      );
      router.refresh();
    })();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (!body.trim()) return;
    handleSend();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StaffMessageFeed messages={shown} threadId={profileId} />
      <div className="border-t border-line px-7 py-4">
        {error ? (
          <p
            className="mb-3 text-[13px]"
            style={{ color: "var(--danger-fg)" }}
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim()) return;
            handleSend();
          }}
        >
          <div
            className="flex items-end gap-2.5 rounded-[8px] border px-3 py-2.5"
            style={{
              background: "var(--chat-field)",
              borderColor: "var(--chat-line)",
            }}
          >
            <textarea
              ref={bodyInput}
              name="body"
              rows={1}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Type a message"
              className="min-w-0 flex-1 resize-none border-none bg-transparent py-1 text-[13.5px] leading-[1.5] outline-none"
              style={{ color: "var(--chat-ink)" }}
            />
            <button
              type="submit"
              disabled={!ready}
              aria-label="Send"
              title={ready ? "Send" : "Nothing to send yet"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition-opacity"
              style={{
                background: "var(--accent)",
                opacity: ready ? 1 : 0.4,
              }}
            >
              <SendArrow />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
