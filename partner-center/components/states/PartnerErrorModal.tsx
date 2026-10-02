"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/base/components/Button";
import { SUPPORT_MAILTO } from "@/partner-center/lib/review-state";

export function PartnerErrorModal({
  open,
  message,
  mode = "retry",
  onClose,
  onRetry,
}: {
  open: boolean;
  message?: string | null;
  mode?: "retry" | "support_only";
  onClose: () => void;
  onRetry?: () => void;
}) {
  if (!open) return null;

  const body =
    message?.trim() ||
    "We couldn't complete that action. Try again, or contact support if it keeps happening.";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-6"
      style={{ background: "rgba(15,15,15,.35)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-error-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-[420px] rounded-xl bg-white p-7 text-center shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "#ffe2dd", color: "#5d1715" }}
          aria-hidden
        >
          <AlertCircle size={22} strokeWidth={2} />
        </div>
        <h2 id="partner-error-title" className="m-0 text-[16px] font-bold">
          Something went wrong
        </h2>
        <p
          className="mt-1.5 mb-5 text-[13.5px] leading-[1.5]"
          style={{ color: "rgba(55,53,47,.6)" }}
        >
          {body}
        </p>
        <div className="flex justify-center gap-2.5">
          <Link
            href={SUPPORT_MAILTO}
            className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2.5 text-[13.5px] font-medium no-underline"
            style={{ color: "var(--ink)" }}
          >
            Contact support
          </Link>
          {mode === "retry" ? (
            <Button
              type="button"
              variant="primary"
              unsized
              className="px-4 py-2.5 text-[13.5px]"
              onClick={() => {
                onClose();
                onRetry?.();
              }}
            >
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
