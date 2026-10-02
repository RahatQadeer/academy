"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { partnerAdminSendMessageAction } from "@/partner-center/admin/lib/actions";

export function PartnerAdminMessageComposer({
  profileId,
}: {
  profileId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-4 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await partnerAdminSendMessageAction({
            profileId,
            body,
          });
          if (result.error) {
            setError(result.error);
            return;
          }
          setBody("");
          router.refresh();
        });
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        placeholder="Reply on Partner Manager…"
        className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink"
      />
      {error ? (
        <p className="text-[13px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" disabled={pending || !body.trim()}>
        {pending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
