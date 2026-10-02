import Link from "next/link";
import { LearnerHero } from "@/academy/components/learner/LearnerHero";

export function ResourcesHeader({
  resourceCount,
  programName,
}: {
  resourceCount?: number;
  programName?: string | null;
}) {
  const countLabel =
    typeof resourceCount === "number"
      ? `${resourceCount.toLocaleString()} file${resourceCount === 1 ? "" : "s"}`
      : null;

  return (
    <LearnerHero
      eyebrow="Academy library"
      title="Resources"
      description="Downloadable templates, guides, and reference files for your enrolled programs. Lessons, videos, quizzes, and assignments stay in My Learning."
      trailing={
        <div className="flex flex-wrap items-center gap-2">
          {countLabel ? (
            <div
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/90 px-3.5 py-2 backdrop-blur-sm"
              style={{ boxShadow: "0 1px 2px rgba(15,15,15,.04)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} aria-hidden />
              <span className="text-[12.5px] font-semibold tabular-nums text-ink">{countLabel}</span>
            </div>
          ) : null}
          <Link
            href="/academy/learning"
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface/90 px-3.5 py-2 text-[12.5px] font-medium text-ink no-underline transition-colors hover:bg-surface-soft"
          >
            My Learning →
          </Link>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        <HintPill label="Templates & guides" />
        <HintPill label="Worksheets & PDFs" />
        <HintPill label="Reference links" />
        {programName ? <HintPill label={programName} accent /> : null}
      </div>
    </LearnerHero>
  );
}

function HintPill({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className="inline-flex max-w-full truncate rounded-full border px-2.5 py-1 text-[11.5px] font-medium"
      style={{
        borderColor: accent ? "color-mix(in srgb, var(--accent) 28%, var(--border))" : "var(--border)",
        background: accent ? "var(--accent-tint)" : "rgba(255,255,255,0.72)",
        color: accent ? "var(--accent)" : "var(--text-secondary)",
      }}
    >
      {label}
    </span>
  );
}
