"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCheckoutSessionAction } from "@/academy/enrollment/actions";
import { checkoutSessionHref } from "@/academy/enrollment/utils/checkoutHref";
import { checkoutMessage } from "@/academy/enrollment/utils/messages";
import { lessonPlayerHref } from "@/academy/lesson-player/utils/curriculum";

export function StartPurchaseButton({
  programId,
  label = "Purchase",
  fullWidth,
}: {
  programId: string;
  label?: string;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const className = fullWidth
    ? "inline-flex w-full items-center justify-center rounded-[6px] px-4 py-2 text-[13.5px]"
    : "inline-flex w-full items-center justify-center rounded-[6px] px-3 py-[7px] text-[13px]";

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        className={className}
        style={{
          background: "var(--accent)",
          color: "#fff",
          opacity: pending ? 0.55 : 1,
          cursor: pending ? "not-allowed" : "pointer",
          border: 0,
        }}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createCheckoutSessionAction(programId);
            if (result.status === "already_enrolled") {
              router.push(lessonPlayerHref(programId));
              router.refresh();
              return;
            }
            if (result.status === "created" || result.status === "existing") {
              router.push(checkoutSessionHref(result.checkout.id));
              router.refresh();
              return;
            }
            setError(checkoutMessage(result.reason));
          });
        }}
      >
        {pending ? "Preparing checkout…" : label}
      </button>
      {error ? (
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: "var(--warning-fg)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PurchaseLink({
  href,
  label,
  fullWidth,
}: {
  href: string;
  label: string;
  fullWidth?: boolean;
}) {
  const className = fullWidth
    ? "inline-flex w-full items-center justify-center rounded-[6px] px-4 py-2 text-[13.5px] no-underline"
    : "inline-flex w-full items-center justify-center rounded-[6px] px-3 py-[7px] text-[13px] no-underline";

  return (
    <Link
      href={href}
      className={className}
      style={{
        background: "var(--accent)",
        color: "#fff",
      }}
    >
      {label}
    </Link>
  );
}
