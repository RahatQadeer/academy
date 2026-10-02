"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePartnerUiOptional } from "@/partner-center/components/PartnerUiProvider";
import { pcType } from "@/partner-center/lib/typography";
import {
  isSessionExpiredMessage,
  sessionExpiredRedirectPath,
} from "@/partner-center/lib/session-errors";
import { cn } from "@/base/lib/cn";
import { MessageFeed } from "@/partner-center/messages/components/MessageFeed";
import { PartnerComposer } from "@/partner-center/messages/components/PartnerComposer";
import { sendMessage } from "@/partner-center/messages/lib/actions";
import { staffDisplay } from "@/partner-center/messages/lib/format";
import type { PartnerMessage } from "@/partner-center/messages/types";

type Shown = PartnerMessage & { pending?: boolean };

function sameBodyNearTime(a: string, aAt: string, b: string, bAt: string) {
  return (
    a === b && Math.abs(Date.parse(aAt) - Date.parse(bAt)) < 120_000
  );
}

function Face({ initials, name }: { initials: string; name: string }) {
  return (
    <span
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[12.5px] font-bold"
      style={{
        background: "var(--avatar-blue-bg)",
        color: "var(--avatar-blue-fg)",
      }}
      title={name}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Instant bubble via local pending — does not wait on the server action. */
export function PartnerThreadPane({
  profileId,
  messages,
  partnerName,
  partnerInitials,
  canSend,
  companyName,
  channel = "partner_manager",
}: {
  profileId: string;
  messages: PartnerMessage[];
  partnerName: string;
  partnerInitials: string;
  canSend: boolean;
  companyName: string;
  channel?: "partner_manager" | "support_billing";
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Shown[]>([]);
  const ui = usePartnerUiOptional();
  const router = useRouter();
  const pathname = usePathname();
  const staff = staffDisplay();

  useEffect(() => {
    setPending((current) => {
      if (current.length === 0) return current;
      const claimed = new Set<string>();
      return current.filter((item) => {
        const match = messages.find(
          (m) =>
            (m.isMine || m.senderType === "partner") &&
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

    const formData = new FormData();
    formData.set("body", trimmed);
    formData.set("profileId", profileId);
    formData.set("channel", channel);
    setBody("");

    const pendingId = `pending-${Date.now()}`;
    setPending((current) => [
      ...current,
      {
        id: pendingId,
        senderType: "partner",
        authorName: partnerName,
        authorInitials: partnerInitials,
        body: trimmed,
        sentAt: new Date().toISOString(),
        isMine: true,
        readStatus: "sent",
        pending: true,
      },
    ]);

    void (async () => {
      try {
        const result = await sendMessage(formData);
        if (result.error) {
          setPending((current) => current.filter((item) => item.id !== pendingId));
          if (isSessionExpiredMessage(result.error)) {
            router.replace(sessionExpiredRedirectPath(pathname));
            return;
          }
          setError(result.error);
          setBody(trimmed);
          ui?.showError({ message: result.error });
          return;
        }

        setPending((current) =>
          current.map((item) =>
            item.id === pendingId ? { ...item, pending: false } : item,
          ),
        );
        router.refresh();
      } catch (caught) {
        setPending((current) => current.filter((item) => item.id !== pendingId));
        const message =
          caught instanceof Error ? caught.message : "Something went wrong.";
        if (isSessionExpiredMessage(message)) {
          router.replace(sessionExpiredRedirectPath(pathname));
          return;
        }
        setError(message);
        setBody(trimmed);
        ui?.showError({ message });
      }
    })();
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      style={{ background: "var(--chat-ground)" }}
    >
      <div
        className="flex items-center justify-between gap-4 border-b border-line px-7 py-4"
        style={{ background: "var(--surface)" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Face name={staff.name} initials={staff.initials} />
          <div className="min-w-0">
            <h2 className={cn("truncate", pcType.title)}>{staff.name}</h2>
            <p
              className={cn("mt-[3px] truncate", pcType.label)}
              style={{ color: "var(--chat-muted)" }}
            >
              Program support · {companyName}
            </p>
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
          <span
            aria-hidden
            className="mb-5 flex h-[76px] w-[76px] items-center justify-center rounded-full"
            style={{
              background: "var(--accent-tint)",
              boxShadow: "0 0 0 8px rgba(55, 53, 47, 0.04)",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden>
              <path
                d="M4.5 12.2c0-2.4 1.9-4.4 4.3-4.4h9.4c2.4 0 4.3 2 4.3 4.4v4.3c0 2.4-1.9 4.4-4.3 4.4h-5.3l-4.6 3.4a.7.7 0 0 1-1.1-.6v-2.9a4.4 4.4 0 0 1-2.7-4.1v-4.5Z"
                fill="var(--accent)"
                fillOpacity=".16"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M24.8 11.4a4.4 4.4 0 0 1 2.7 4v4.2a4.4 4.4 0 0 1-2.6 4v2.7a.7.7 0 0 1-1.1.6l-3.4-2.5"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p
            className={cn(pcType.page, "tracking-[-0.2px]")}
            style={{ color: "var(--chat-ink)", margin: 0 }}
          >
            No messages yet
          </p>
          <p
            className={cn("mt-2 max-w-[380px] leading-[1.6]", pcType.body)}
            style={{ color: "var(--chat-muted)", margin: "8px 0 0" }}
          >
            When Private Attaché reaches out about a referral, opportunity, or
            your account, it will show up here. You can write first anytime.
          </p>
        </div>
      ) : (
        <MessageFeed messages={shown} threadId={profileId} />
      )}

      {canSend ? (
        <PartnerComposer
          value={body}
          onChange={setBody}
          onSubmit={handleSend}
          error={error}
        />
      ) : null}
    </div>
  );
}
