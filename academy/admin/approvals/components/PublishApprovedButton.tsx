"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { publishApprovedProgramAction } from "../actions";

export function PublishApprovedButton({
  requestId,
  embedded = false,
}: {
  requestId: string;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"published" | "already_published" | null>(null);
  const [pending, startTransition] = useTransition();

  function publish() {
    startTransition(async () => {
      setError(null);
      const result = await publishApprovedProgramAction(requestId);
      if (!result.ok) {
        setError(result.message || "The program could not be published.");
        return;
      }
      setDone(result.status);
      router.refresh();
    });
  }

  if (done) {
    if (embedded) {
      return (
        <Callout tone="success" title="Program published">
          {done === "already_published"
            ? "This program was already live in Explore."
            : "This program is now live in Explore."}
        </Callout>
      );
    }
    return (
      <Callout tone="success" title="Program published">
        {done === "already_published"
          ? "This program was already live in Explore."
          : "This program is now live in Explore."}
      </Callout>
    );
  }

  if (embedded) {
    return (
      <>
        {error ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
            {error}
          </p>
        ) : null}
        <div className="mt-4">
          <Button variant="primary" disabled={pending} onClick={publish}>
            {pending ? "Publishing…" : "Publish to catalog"}
          </Button>
        </div>
      </>
    );
  }

  return (
    <section
      className="rounded-[10px] bg-surface p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <h2 className="text-[13.5px] font-medium">Publish</h2>
      <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        This request is approved. Publishing is the last step — it adds the program to Explore.
        You or the instructor can complete it.
      </p>
      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--danger-fg)" }}>
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        <Button variant="primary" disabled={pending} onClick={publish}>
          {pending ? "Publishing…" : "Publish"}
        </Button>
      </div>
    </section>
  );
}
