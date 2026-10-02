"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/base/components/Button";

/** Re-runs the server render for the current route. */
export function RetryButton({ label = "Try again" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Retrying…" : label}
    </Button>
  );
}
