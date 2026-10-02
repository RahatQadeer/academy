import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { ProgressBar } from "@/base/components/ProgressBar";
import {
  courseAccessLabel,
  courseRecognitionLabel,
  programTypeLabel,
} from "@/academy/lib/domain";
import type { ExploreProgramDetail, ExploreRelatedProgram } from "../types";
import { formatProgramPrice } from "../utils/accessState";
import { ProgramAccessStateControl } from "./ProgramAccessState";
import { ProgramCover, ProgramCoverArt } from "./ProgramCover";

function badgeStyle(type: ExploreProgramDetail["type"]) {
  if (type === "certification_program") {
    return { background: "var(--module-academy-bg)", color: "var(--module-academy-fg)" };
  }
  if (type === "endorsement_program") {
    return { background: "var(--info-bg)", color: "var(--info-fg)" };
  }
  if (type === "short_course") {
    return { background: "var(--success-bg)", color: "var(--success-fg)" };
  }
  return { background: "var(--module-whitby-bg)", color: "var(--module-whitby-fg)" };
}

function accessBadgeStyle(accessMode: ExploreProgramDetail["accessMode"]) {
  if (accessMode === "free") {
    return { background: "var(--success-bg)", color: "var(--success-fg)" };
  }
  if (accessMode === "purchased") {
    return { background: "var(--accent-tint)", color: "var(--accent)" };
  }
  return { background: "var(--surface-soft)", color: "var(--text-secondary)" };
}

function actionNote(detail: ExploreProgramDetail): string | null {
  if (detail.access.kind === "prerequisite_blocked") {
    if (detail.prerequisiteName) {
      return `${detail.prerequisiteName} is listed as related. You can still start this program when published.`;
    }
    return "A related program is listed for context. Enrollment stays open.";
  }
  if (detail.access.kind === "purchase") {
    return "Purchase unlocks the full course. You’ll review payment next, then access opens in the lesson player.";
  }
  if (detail.access.kind === "available") {
    return detail.accessMode === "free" || detail.access.badge === "Free"
      ? "Start enrolls you at no charge. Continue anytime from My Learning."
      : "Open to Academy learners. Start enrolls you — continue anytime from My Learning.";
  }
  if (detail.access.kind === "access_required") {
    return "Access is not available yet. Contact Academy Admin if you should have access.";
  }
  if (detail.access.kind === "enrolled" || detail.access.kind === "in_progress") {
    return "You’re enrolled. Continue opens the lesson player for this program.";
  }
  if (detail.access.kind === "completed") {
    return "This program is completed. Review opens the lesson player.";
  }
  return null;
}

export function ProgramDetail({ detail }: { detail: ExploreProgramDetail }) {
  const typeLabel = detail.category?.trim() || programTypeLabel(detail.type);
  const note = actionNote(detail);
  const showProgress =
    detail.progressPercent != null &&
    (detail.enrollmentStatus === "enrolled" ||
      detail.enrollmentStatus === "in_progress" ||
      detail.enrollmentStatus === "completed");
  const accessLabel =
    detail.accessMode === "purchased"
      ? "Paid"
      : detail.accessMode === "free"
        ? "Free"
        : courseAccessLabel(detail.accessMode);

  const facts: { label: string; value: string }[] = [
    { label: "Type", value: accessLabel },
    { label: "Tag", value: courseRecognitionLabel(detail.recognition) },
    { label: "Format", value: programTypeLabel(detail.type) },
    { label: "Price", value: formatProgramPrice(detail.price) },
  ];
  if (detail.category) facts.push({ label: "Topic", value: detail.category });
  if (detail.moduleCount > 0) {
    facts.push({ label: "Modules", value: String(detail.moduleCount) });
  }

  return (
    <div className="relative px-5 pb-14 pt-8 sm:px-7 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[240px]"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 10% 0%, color-mix(in srgb, var(--accent-tint) 60%, transparent), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[920px]">
        <Link
          href="/academy/explore"
          className="inline-flex items-center gap-1.5 text-[13.5px] no-underline transition-colors hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
        >
          <span aria-hidden>←</span>
          Back to Explore
        </Link>

        {/* Full-width hero */}
        <div className="group relative mt-5 overflow-hidden rounded-[16px]">
          {detail.coverImageUrl ? (
            <ProgramCover src={detail.coverImageUrl} alt={detail.name} framed={false} />
          ) : (
            <div className="overflow-hidden rounded-[16px]">
              <ProgramCoverArt type={detail.type} />
            </div>
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
            style={{
              background:
                "linear-gradient(to top, color-mix(in srgb, var(--ink) 35%, transparent), transparent)",
            }}
          />
        </div>

        {/* Title + enroll — one balanced band, no empty sidebar */}
        <section
          className="mt-5 overflow-hidden rounded-[14px]"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)]">
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex rounded-[5px] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.04em]"
                  style={badgeStyle(detail.type)}
                >
                  {typeLabel}
                </span>
                <span
                  className="inline-flex rounded-[5px] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.04em]"
                  style={accessBadgeStyle(detail.accessMode)}
                >
                  {accessLabel}
                </span>
              </div>
              <h1
                className="mt-3 text-[24px] font-bold leading-[1.18] tracking-[-0.45px] text-pretty sm:text-[30px]"
                style={{ color: "var(--ink)" }}
              >
                {detail.name}
              </h1>
              {detail.description ? (
                <p
                  className="mt-3 text-[14.5px] leading-[1.65] text-pretty"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {detail.description}
                </p>
              ) : null}
            </div>

            <div
              className="flex flex-col justify-center gap-3 border-t px-5 py-5 sm:px-6 lg:border-t-0 lg:border-l"
              style={{
                borderColor: "var(--border)",
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--accent-tint) 55%, white) 0%, var(--surface) 55%)",
              }}
            >
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {showProgress ? "Your progress" : "Get started"}
                </p>
                <p
                  className="mt-1 text-[15px] font-semibold tracking-[-0.2px]"
                  style={{ color: "var(--ink)" }}
                >
                  {showProgress
                    ? `${detail.progressPercent}% complete`
                    : accessLabel === "Free"
                      ? "Free to start"
                      : accessLabel === "Paid"
                        ? formatProgramPrice(detail.price)
                        : "Enrollment"}
                </p>
              </div>

              {showProgress ? (
                <div>
                  <ProgressBar value={detail.progressPercent ?? 0} />
                  <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    Continue from where you left off
                  </p>
                </div>
              ) : null}

              <ProgramAccessStateControl
                access={detail.access}
                programId={detail.id}
                fullWidth
              />

              {note ? (
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {note}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Facts — full width */}
        <ul
          className="mt-5 grid gap-px overflow-hidden rounded-[12px] grid-cols-2 sm:grid-cols-3"
          style={{ border: "1px solid var(--border)", background: "var(--border)" }}
        >
          {facts.map((fact) => (
            <li key={fact.label} className="px-4 py-3.5" style={{ background: "var(--surface)" }}>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                {fact.label}
              </p>
              <p className="mt-1 text-[14px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
                {fact.value}
              </p>
            </li>
          ))}
        </ul>

        {detail.prerequisiteProgramId && detail.prerequisiteName ? (
          <div
            className="mt-5 rounded-[12px] px-4 py-3.5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-tertiary)" }}
            >
              Related program
            </p>
            <p className="mt-1 text-[14px] font-medium" style={{ color: "var(--ink)" }}>
              {detail.prerequisiteName}
            </p>
          </div>
        ) : null}

        {/* Curriculum */}
        {detail.contentUnlocked && detail.modules.length > 0 ? (
          <section className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Curriculum
                </h2>
                <p
                  className="mt-1 text-[18px] font-semibold tracking-[-0.3px]"
                  style={{ color: "var(--ink)" }}
                >
                  What’s inside
                </p>
              </div>
              <p className="text-[12.5px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                {detail.modules.length}{" "}
                {detail.modules.length === 1 ? "module" : "modules"}
              </p>
            </div>
            <ol
              className="mt-4 overflow-hidden rounded-[14px]"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            >
              {detail.modules.map((module, index) => (
                <li
                  key={module.id}
                  className="flex items-center gap-3.5 border-b px-4 py-3.5 last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[12.5px] font-semibold tabular-nums"
                    style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 text-[14.5px] font-medium leading-snug text-pretty">
                    {module.title}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : detail.moduleCount > 0 && !detail.contentUnlocked ? (
          <section className="mt-8">
            <Callout tone="info" title="Course content locked">
              This program includes {detail.moduleCount} modules. Complete purchase to unlock the
              full curriculum, lessons, and assessments.
            </Callout>
          </section>
        ) : null}

        {/* Related */}
        {detail.nextCourses.length > 0 || detail.relatedCourses.length > 0 ? (
          <section className="mt-8 space-y-7">
            {detail.nextCourses.length > 0 ? (
              <div>
                <h2
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Recommended next
                </h2>
                <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  Suggested after this program. You can take other courses anytime.
                </p>
                <RelatedProgramList items={detail.nextCourses} />
              </div>
            ) : null}
            {detail.relatedCourses.length > 0 ? (
              <div>
                <h2
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Related learning
                </h2>
                <RelatedProgramList items={detail.relatedCourses} />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function RelatedProgramList({ items }: { items: ExploreRelatedProgram[] }) {
  return (
    <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/academy/explore/${item.id}`}
            className="group flex h-full flex-col justify-between rounded-[12px] px-4 py-3.5 no-underline transition-colors hover:bg-[var(--surface-soft)]"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--ink)",
            }}
          >
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold leading-snug tracking-[-0.15px] text-pretty">
                {item.name}
              </span>
              <span className="mt-1 block text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                {programTypeLabel(item.type)}
              </span>
            </span>
            <span
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium group-hover:text-accent-hover"
              style={{ color: "var(--accent)" }}
            >
              View
              <span aria-hidden>→</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProgramDetailUnavailable() {
  return (
    <div className="px-5 py-10 sm:px-7 lg:px-12">
      <div className="mx-auto max-w-[920px]">
        <Link
          href="/academy/explore"
          className="inline-flex items-center gap-1.5 text-[13.5px] no-underline hover:text-accent-hover"
          style={{ color: "var(--accent)" }}
        >
          <span aria-hidden>←</span>
          Back to Explore
        </Link>
        <div className="mt-6 max-w-xl">
          <Callout tone="warning" title="This course is not available">
            This program is no longer in the Academy catalog. If you already earned a certificate, it
            stays in Certificates & Credentials.
          </Callout>
        </div>
      </div>
    </div>
  );
}
