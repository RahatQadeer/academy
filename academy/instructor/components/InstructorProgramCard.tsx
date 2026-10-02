import Link from "next/link";
import { programTypeLabel } from "@/academy/lib/domain";
import type { InstructorProgramItem } from "../types";
import {
  formatInstructorDate,
  permissionLabel,
  programTypeMark,
  structureLabel,
} from "../utils/labels";
import { InstructorStatus } from "./InstructorStatus";

function markStyle(type: InstructorProgramItem["programType"]) {
  if (type === "certification_program") {
    return { background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" };
  }
  return { background: "var(--module-whitby-bg)", color: "var(--module-whitby-fg)" };
}

export function InstructorProgramCard({ item }: { item: InstructorProgramItem }) {
  const typeLabel = item.category?.trim() || programTypeLabel(item.programType);
  const href = `/academy/instructor/programs/${item.programId}`;

  return (
    <article
      className="flex flex-col gap-4 rounded-[10px] bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-5"
      style={{ border: "1px solid var(--border)" }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold"
        style={markStyle(item.programType)}
        aria-hidden
      >
        {programTypeMark(item.programType)}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-medium leading-snug text-pretty">
          <Link href={href} className="no-underline hover:text-accent-hover" style={{ color: "inherit" }}>
            {item.programName}
          </Link>
        </h3>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          {typeLabel} · {permissionLabel(item.permissionLevel)} ·{" "}
          {structureLabel(item.moduleCount, item.lessonCount)}
        </p>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Updated {formatInstructorDate(item.updatedAt)}
        </p>
      </div>

      <div className="sm:shrink-0 sm:text-right">
        <InstructorStatus
          programStatus={item.programStatus}
          publishRequestStatus={item.publishRequestStatus}
        />
        <Link
          href={href}
          className="mt-2 inline-block text-[13px] no-underline hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
        >
          Open
        </Link>
      </div>
    </article>
  );
}
