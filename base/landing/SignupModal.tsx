"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconClose } from "@/base/landing/brand/Icons";
import { Monogram } from "@/base/landing/brand/Monogram";
import { LANDING_AUTH } from "@/base/landing/auth";

type SignupModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional override for Continue with email (e.g. partner apply). */
  emailHref?: string;
  /** Optional override for Google OAuth next path. */
  googleNext?: string;
};

export function SignupModal({
  open,
  onClose,
  emailHref = LANDING_AUTH.getStarted,
  googleNext = "/switcher",
}: SignupModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-pa-ink/50 p-5">
      <div className="relative w-full max-w-[380px] rounded-[14px] bg-white px-7 pt-7 pb-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-pa-ink/40 transition-colors duration-200 hover:text-pa-ink"
          aria-label="Close"
        >
          <IconClose size={18} />
        </button>
        <div className="mb-4">
          <Monogram size={28} variant="ink" />
        </div>
        <div className="mb-4 text-lg font-bold tracking-[-0.3px]">
          Create your free account
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="rounded-lg border border-pa-line bg-white p-2.5 text-[13.5px] font-semibold transition-colors duration-200 hover:bg-pa-panel"
            onClick={() => {
              window.location.assign(
                `/auth/google?next=${encodeURIComponent(googleNext)}`,
              );
            }}
          >
            Continue with Google
          </button>
        </div>
        <Link
          href={emailHref}
          className="mt-3 block w-full rounded-lg bg-pa-blue p-[11px] text-center text-[13.5px] font-bold text-white no-underline transition-colors duration-200 hover:bg-pa-blue-dark"
        >
          Continue with email
        </Link>
        <p className="mt-3 text-center text-[12.5px] text-pa-muted">
          No card. Your first plan is free.
        </p>
        <p className="mt-2 text-center text-[12.5px] text-pa-muted">
          Already have an account?{" "}
          <Link href={LANDING_AUTH.signIn} className="font-semibold text-pa-ink no-underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
