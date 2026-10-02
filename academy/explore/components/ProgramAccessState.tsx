"use client";

import Link from "next/link";
import type { ProgramAccessState } from "../types";
import { StartFreeEnrollmentButton } from "./StartFreeEnrollmentButton";
import { PurchaseLink, StartPurchaseButton } from "@/academy/enrollment/components/StartPurchaseButton";

export function ProgramAccessStateControl({
  access,
  programId,
  fullWidth,
  stayOnPage,
}: {
  access: ProgramAccessState;
  programId: string;
  fullWidth?: boolean;
  stayOnPage?: boolean;
}) {
  const className = fullWidth
    ? "inline-flex w-full items-center justify-center rounded-[6px] px-4 py-2 text-[13.5px] no-underline"
    : "inline-flex w-full items-center justify-center rounded-[6px] px-3 py-[7px] text-[13px] no-underline";

  if (access.kind === "available") {
    return <StartFreeEnrollmentButton programId={programId} fullWidth={fullWidth} />;
  }

  if (access.kind === "purchase") {
    if (access.href) {
      return <PurchaseLink href={access.href} label={access.label} fullWidth={fullWidth} />;
    }
    return <StartPurchaseButton programId={programId} label={access.label} fullWidth={fullWidth} />;
  }

  if (access.kind === "prerequisite_blocked" || access.kind === "access_required") {
    return (
      <span
        className={className}
        style={{
          background: "var(--surface-soft)",
          color: "var(--text-tertiary)",
        }}
      >
        {access.label}
      </span>
    );
  }

  const continueLike =
    access.kind === "enrolled" || access.kind === "in_progress" || access.kind === "completed";

  if (continueLike && (stayOnPage || !access.href)) {
    return (
      <span
        className={className}
        style={{
          background: "var(--surface-soft)",
          color: "var(--ink)",
        }}
      >
        {access.label}
      </span>
    );
  }

  if (!access.href) {
    return (
      <span
        className={className}
        style={{
          background: "var(--surface-soft)",
          color: "var(--text-tertiary)",
        }}
      >
        {access.label}
      </span>
    );
  }

  if (continueLike) {
    return (
      <Link
        href={access.href}
        className={className}
        style={{
          background: "var(--surface-soft)",
          color: "var(--ink)",
        }}
      >
        {access.label}
      </Link>
    );
  }

  return (
    <Link
      href={access.href}
      className={className}
      style={{
        background: "var(--accent)",
        color: "#fff",
      }}
    >
      {access.label}
    </Link>
  );
}
