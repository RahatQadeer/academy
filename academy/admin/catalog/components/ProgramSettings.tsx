"use client";

import { Callout } from "@/base/components/Callout";
import Link from "next/link";
import { useProgramCover, ProgramCoverBanner, ProgramCoverCameraButton } from "./ProgramCoverImage";
import {
  countLessons,
  countQuestions,
  estimatedDuration,
  formatMinutes,
  totalMinutes,
} from "../lib/programStats";
import { courseRecognitionLabel } from "@/academy/lib/domain";
import {
  ACADEMY_LEARNING_PATH_OPTIONS,
} from "@/academy/lib/programAccessPolicy";
import {
  DEFAULT_ACCESS_BY_TYPE,
  DEFAULT_LEARNING_PATH_BY_TYPE,
  DEFAULT_VALIDITY_BY_RECOGNITION,
  courseRecognitionOptions,
  credentialValidityOptions,
  programTypeForRecognition,
} from "@/academy/lib/courseMetadata";
import type {
  AcademyCourseRecognition,
  AcademyCredentialValidity,
  AcademyLearningPath,
  AcademyProgramType,
} from "@/academy/lib/domain";
import {
  catalogProgramCanBeDeleted,
  catalogProgramDeletionMessage,
  getCatalogProgramDeletionBlock,
} from "@/academy/admin/lib/programDeletion";
import type { CatalogProgramDetail } from "../types";
import { FinalAssessmentPanel } from "./FinalAssessmentPanel";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";
import { PricingAccessField } from "@/academy/components/PricingAccessField";
import { CourseTagsFieldLoader } from "@/academy/components/CourseTagsFieldLoader";

const LEARNING_PATH_OPTIONS = ACADEMY_LEARNING_PATH_OPTIONS;

/* ── icon ────────────────────────────────────────────────────── */

function I({ d, s = 15, c = "currentColor", w = 1.7 }: { d: string; s?: number; c?: string; w?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ic = {
  image: "M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  clock: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  question: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  check: "M20 6 9 17l-5-5",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
};

/* ── shared input ────────────────────────────────────────────── */

const inp = "w-full rounded-[8px] border px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-[var(--accent,#2383e2)] focus:shadow-[0_0_0_3px_rgba(35,131,226,.10)]";
const inpSt: React.CSSProperties = { borderColor: "var(--border-strong)", color: "var(--ink)", background: "var(--surface)" };

/* ── main ────────────────────────────────────────────────────── */

export function ProgramSettings({
  program,
  onChange,
  onDeleteProgram,
  disabled,
  showFinalAssessment = false,
}: {
  program: CatalogProgramDetail;
  onChange: (patch: Partial<CatalogProgramDetail>) => void;
  onDeleteProgram?: () => void;
  disabled?: boolean;
  showFinalAssessment?: boolean;
}) {
  const cover = useProgramCover({
    programId: program.id,
    coverImageUrl: program.coverImageUrl,
    disabled: Boolean(disabled),
    onChange: (url) => onChange({ coverImageUrl: url }),
  });

  const lessons = countLessons(program);
  const questions = countQuestions(program);
  const minutes = totalMinutes(program);
  const duration = estimatedDuration(program);
  const recognitionChoices = courseRecognitionOptions();
  const certificateLabel = courseRecognitionLabel(
    program.recognition === "none" || !program.recognition
      ? "certificate_of_completion"
      : program.recognition,
  );
  const deletionBlock = getCatalogProgramDeletionBlock({
    status: program.status,
    enrollmentCount: program.enrollmentCount,
    activeEnrollmentCount: program.activeEnrollmentCount,
  });
  const canDelete = catalogProgramCanBeDeleted({
    status: program.status,
    enrollmentCount: program.enrollmentCount,
    activeEnrollmentCount: program.activeEnrollmentCount,
  });

  const stats = [
    { icon: ic.book, v: String(program.modules.length), l: "Modules" },
    { icon: ic.file, v: String(lessons), l: "Lessons" },
    { icon: ic.question, v: String(questions), l: "Questions" },
    { icon: ic.clock, v: formatMinutes(minutes), l: "Learning time" },
    { icon: ic.calendar, v: duration, l: "Pace" },
    { icon: ic.layers, v: certificateLabel, l: "Certificate" },
  ];

  return (
    <div className="min-h-full" style={{ background: "var(--surface)" }}>
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-10 sm:py-10">
        <div className="space-y-10">
          <Section title="Cover image" description="Add the visual learners will see on cards, explore, and the program hero.">
            {cover.src ? (
              <div className="overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--border)" }}>
                <ProgramCoverBanner {...cover} onRemove={disabled ? undefined : cover.remove} size="preview" />
              </div>
            ) : disabled ? (
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                No cover image.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById(cover.inputId)?.click()}
                className="group flex w-full cursor-pointer items-center gap-4 rounded-[10px] border-2 border-dashed px-5 py-7 text-left transition-all hover:border-[var(--accent,#2383e2)] hover:bg-[rgba(35,131,226,.02)]"
                style={{ borderColor: "var(--border-dashed, var(--border))", background: "transparent" }}
              >
                <span
                  className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[12px] transition-colors group-hover:bg-[var(--accent-tint-soft,#e7f1fb)]"
                  style={{ background: "var(--surface-soft, #f7f7f5)" }}
                >
                  <I d={ic.upload} s={22} c="var(--text-tertiary)" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
                    Click to upload
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    JPG, PNG or WebP. 16:9 ratio recommended.
                  </p>
                </div>
              </button>
            )}
            {cover.input}
            {cover.error ? (
              <p className="mt-2 text-[11.5px]" style={{ color: "#c4554d" }}>{cover.error}</p>
            ) : null}
            {cover.cropDialog}
          </Section>

          <Section
            title="Program basics"
            description="The core details learners notice first."
          >
            <div className="space-y-5">
              <div>
                <Lbl>Program title</Lbl>
                <input
                  type="text"
                  value={program.name}
                  disabled={disabled}
                  onChange={(e) => onChange({ name: e.target.value })}
                  className={inp}
                  style={inpSt}
                />
                <p
                  className="mt-1.5 text-right text-[11px] tabular-nums"
                  style={{ color: program.name.length > 80 ? "#c4554d" : "var(--text-tertiary)" }}
                >
                  {program.name.length} / 80
                </p>
              </div>

              <div>
                <Lbl>Description</Lbl>
                <textarea
                  value={program.description}
                  disabled={disabled}
                  onChange={(e) => onChange({ description: e.target.value })}
                  rows={5}
                  className={`${inp} resize-y`}
                  style={inpSt}
                  placeholder="What will learners achieve after completing this program?"
                />
              </div>

              <div>
                <FilterSelect
                  tone="field"
                  size="md"
                  label="Certificate classification"
                  value={
                    program.recognition === "none" || !program.recognition
                      ? "certificate_of_completion"
                      : program.recognition
                  }
                  disabled={disabled}
                  onChange={(value) => {
                    const nextRecognition = value as AcademyCourseRecognition;
                    const nextType = programTypeForRecognition(nextRecognition, program.type as AcademyProgramType);
                    onChange({
                      recognition: nextRecognition,
                      type: nextType,
                      access: program.access || DEFAULT_ACCESS_BY_TYPE[nextType],
                      learningPath: program.learningPath || DEFAULT_LEARNING_PATH_BY_TYPE[nextType],
                      credentialValidity:
                        program.credentialValidity === "three_years" ||
                        program.credentialValidity === "none"
                          ? program.credentialValidity
                          : DEFAULT_VALIDITY_BY_RECOGNITION[nextRecognition],
                    });
                  }}
                  options={recognitionChoices.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>

              <CourseTagsFieldLoader
                value={program.tagIds ?? []}
                disabled={disabled}
                onChange={(tagIds) => onChange({ tagIds })}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FilterSelect
                  tone="field"
                  size="md"
                  label="Learning path"
                  value={program.learningPath || "business_and_practice"}
                  disabled={disabled}
                  onChange={(value) => onChange({ learningPath: value as AcademyLearningPath })}
                  options={LEARNING_PATH_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <FilterSelect
                  tone="field"
                  size="md"
                  label="Certificate validity"
                  value={program.credentialValidity || "none"}
                  disabled={disabled}
                  onChange={(value) =>
                    onChange({ credentialValidity: value as AcademyCredentialValidity })
                  }
                  options={credentialValidityOptions()}
                />
              </div>

              <p className="-mt-2 text-[11.5px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                {program.credentialValidity === "three_years"
                  ? "Awards expire 3 years after the award date. Learners get email reminders at 90, 60, and 30 days before expiry."
                  : "Certificates from this program do not expire. Choose 3 years for renewable credentials such as Certified Private Attaché."}
              </p>

              <PricingAccessField
                access={program.access || "free"}
                price={program.price}
                disabled={disabled}
                onAccessChange={(next) =>
                  onChange({
                    access: next,
                    ...(next === "free" ? { price: "" } : {}),
                  })
                }
                onPriceChange={(price) => onChange({ price })}
              />

              <div>
                <FilterSelect
                  tone="field"
                  size="md"
                  label="Prerequisite"
                  value={program.prerequisiteProgramId ?? ""}
                  disabled={disabled}
                  placeholder="None"
                  onChange={(value) => onChange({ prerequisiteProgramId: value })}
                  options={[
                    { value: "", label: "None" },
                    ...(program.prerequisites ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
                    })),
                  ]}
                />
                <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                  Not enforced — every published program is open to Academy learners. Use this only as
                  an optional related-program note.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Curriculum snapshot" description="A quick summary generated from the program structure you've built so far.">
            <div
              className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border sm:grid-cols-3 lg:grid-cols-6"
              style={{ borderColor: "var(--border)", background: "var(--border)" }}
            >
              {stats.map((s) => (
                <div key={s.l} className="px-3 py-3 text-center" style={{ background: "var(--surface-soft, #f7f7f5)" }}>
                  <p className="text-[15px] font-bold leading-none tabular-nums tracking-[-0.3px]" style={{ color: "var(--ink)" }}>
                    {s.v}
                  </p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.04em]" style={{ color: "var(--text-tertiary)" }}>
                    {s.l}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {onDeleteProgram && !disabled ? (
            <Section
              title="Delete program"
              description="Hide a published program instead of deleting it. Certificates already issued to learners stay in Certificates & Credentials."
            >
              {canDelete ? (
                <button
                  type="button"
                  onClick={onDeleteProgram}
                  className="rounded-[6px] px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ background: "#a8433b", border: "none" }}
                >
                  Delete program
                </button>
              ) : (
                <Callout tone="warning" title="This program can't be deleted">
                  <p>
                    {deletionBlock
                      ? catalogProgramDeletionMessage(deletionBlock, program.activeEnrollmentCount)
                      : "This program can't be deleted."}
                  </p>
                  {program.status === "published" ? (
                    <p className="mt-2">
                      Use Hide from catalog in the top bar. New learners will not see it in Explore.
                      Anyone already enrolled can keep learning and keep their certificates.
                    </p>
                  ) : null}
                  {program.activeEnrollmentCount > 0 ? (
                    <p className="mt-2">
                      <Link
                        href={`/academy/admin/enrollments/program/${program.id}`}
                        className="font-medium no-underline"
                        style={{ color: "var(--accent)" }}
                      >
                        View enrollments
                      </Link>
                    </p>
                  ) : null}
                </Callout>
              )}
            </Section>
          ) : null}

          {showFinalAssessment ? (
            <div className="py-7">
              <FinalAssessmentPanel program={program} disabled={disabled} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── layout primitives ───────────────────────────────────────── */

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-7" style={{ borderColor: "var(--border)" }}>
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-[-0.2px]" style={{ color: "var(--ink)" }}>{title}</h3>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>{description}</p>
      </div>
      {children}
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
      {children}
    </label>
  );
}
