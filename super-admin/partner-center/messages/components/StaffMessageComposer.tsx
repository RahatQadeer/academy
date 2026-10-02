"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { FormError } from "@/base/components/AuthControls";
import { sendStaffMessageAction } from "@/super-admin/partner-center/messages/actions";

export function StaffMessageComposer({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = body.trim();
    if (!trimmed) {
      setError("Write a message before sending.");
      return;
    }

    startTransition(async () => {
      const result = await sendStaffMessageAction({
        profileId,
        body: trimmed,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="border-t border-line px-8 py-5 md:px-10">
      <form onSubmit={handleSubmit}>
        <div
          className="flex items-end gap-3 rounded-lg border border-line-strong px-3.5 py-3"
          style={{ background: "#fff" }}
        >
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message to this partner…"
            rows={1}
            disabled={pending}
            className="min-h-[24px] flex-1 resize-none border-0 bg-transparent p-0 text-[13.5px] text-ink outline-none placeholder:text-[rgba(55,53,47,0.4)]"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={pending || !body.trim()}
            className="shrink-0 px-3.5 py-1.5 text-[13px]"
          >
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
        {error ? <FormError message={error} /> : null}
      </form>
    </div>
  );
}
