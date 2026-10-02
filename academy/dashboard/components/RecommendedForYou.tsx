import Link from "next/link";
import { SectionHeading } from "@/academy/components/ui";
import { programTypeLabel } from "@/academy/lib/domain";
import type { AcademyInterestId } from "@/academy/onboarding/lib/interests";
import { ACADEMY_INTERESTS } from "@/academy/onboarding/lib/interests";
import type { RecommendedProgram } from "../types";

function actionCopy(action: RecommendedProgram["action"]) {
  if (action === "start") return { label: "Start", locked: false };
  return { label: "View", locked: false };
}

function typeTone(type: RecommendedProgram["type"]) {
  if (type === "certification_program") {
    return {
      background: "var(--module-academy-bg)",
      color: "var(--module-academy-fg)",
    };
  }
  if (type === "endorsement_program") {
    return {
      background: "var(--info-bg)",
      color: "var(--info-fg)",
    };
  }
  if (type === "short_course") {
    return {
      background: "var(--module-whitby-bg)",
      color: "var(--module-whitby-fg)",
    };
  }
  return {
    background: "var(--surface-soft)",
    color: "var(--text-secondary)",
  };
}

function interestLabels(interestIds: AcademyInterestId[]) {
  return interestIds
    .map((id) => ACADEMY_INTERESTS.find((item) => item.id === id)?.label)
    // `label` is the literal union `ACADEMY_INTERESTS` declares, not `string`,
    // so narrowing to `string` is wider than the value being narrowed and
    // TypeScript refuses it. `NonNullable` drops the undefined the `?.` above
    // introduces and keeps the union intact.
    .filter((label): label is NonNullable<typeof label> => Boolean(label));
}

function FeaturedRecommendation({ item }: { item: RecommendedProgram }) {
  const action = actionCopy(item.action);
  const tone = typeTone(item.type);

  const content = (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex rounded-[4px] px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.04em]"
          style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
        >
          Featured
        </span>
        <span
          className="inline-flex rounded-[4px] px-2 py-[3px] text-[10.5px] font-medium"
          style={tone}
        >
          {programTypeLabel(item.type)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-[64ch]">
          <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.25px] text-pretty transition-colors duration-200 group-hover:text-accent sm:text-[18px]">
            {item.name}
          </h3>
          {item.description ? (
            <p
              className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-pretty"
              style={{ color: "var(--text-secondary)" }}
            >
              {item.description}
            </p>
          ) : null}
        </div>

        <div className="shrink-0">
          {action.locked ? (
            <span
              className="inline-flex items-center rounded-[7px] border border-line px-3 py-2 text-[12.5px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {action.label}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-[7px] px-3 py-2 text-[12.5px] font-medium text-white transition-transform duration-200 group-hover:-translate-y-px"
              style={{ background: "var(--ink)" }}
            >
              {action.label}
              <span aria-hidden>→</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (action.locked) {
    return <article className="border-b border-line px-5 py-5 sm:px-6">{content}</article>;
  }

  return (
    <Link
      href={`/academy/explore/${item.id}`}
      className="group block border-b border-line px-5 py-5 text-ink no-underline transition-colors duration-200 hover:bg-surface-soft sm:px-6"
    >
      {content}
    </Link>
  );
}

function RecommendationRow({
  item,
  index,
}: {
  item: RecommendedProgram;
  index: number;
}) {
  const action = actionCopy(item.action);
  const tone = typeTone(item.type);
  const ordinal = String(index + 1).padStart(2, "0");

  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-semibold tabular-nums transition-colors duration-200 group-hover:bg-[var(--accent-tint)] group-hover:text-accent"
          style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
        >
          {ordinal}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-semibold leading-snug tracking-[-0.12px] text-pretty transition-colors duration-200 group-hover:text-accent">
              {item.name}
            </h3>
            <span
              className="inline-flex rounded-[4px] px-1.5 py-px text-[10px] font-medium"
              style={tone}
            >
              {programTypeLabel(item.type)}
            </span>
          </div>
        </div>
      </div>
      <span
        className="mt-2 shrink-0 text-[12.5px] font-medium sm:mt-0"
        style={{ color: action.locked ? "var(--text-tertiary)" : "var(--accent)" }}
      >
        {action.locked ? action.label : `${action.label} →`}
      </span>
    </>
  );

  if (action.locked) {
    return (
      <div className="flex flex-col px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/academy/explore/${item.id}`}
      className="group flex flex-col px-5 py-3.5 text-ink no-underline transition-colors duration-200 hover:bg-surface-soft sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"
    >
      {body}
    </Link>
  );
}

export function RecommendedForYou({
  interestIds,
  items,
}: {
  interestIds: AcademyInterestId[];
  items: RecommendedProgram[];
}) {
  const labels = interestLabels(interestIds).slice(0, 4);
  const [featured, ...rest] = items;

  return (
    <section
      aria-labelledby="recommended-heading"
      className="academy-desk-reveal academy-desk-reveal-d3"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <SectionHeading id="recommended-heading" className="mb-0">
          Recommended for you
        </SectionHeading>
        <Link
          href="/academy/explore"
          className="group inline-flex items-center gap-1 text-[12.5px] font-medium text-accent no-underline transition-colors hover:text-accent-hover"
        >
          Catalog
          <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>

      {labels.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <span
              key={label}
              className="inline-flex rounded-[5px] border border-line bg-surface px-2 py-[3px] text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div
          className="rounded-[12px] border border-dashed px-5 py-7 text-center sm:px-6"
          style={{ borderColor: "var(--border-dashed)", background: "var(--surface)" }}
        >
          <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
            No recommendations yet.
          </p>
          <Link
            href="/academy/explore"
            className="mt-4 inline-flex items-center rounded-[7px] px-3.5 py-2 text-[13px] font-medium text-white no-underline"
            style={{ background: "var(--ink)" }}
          >
            Explore catalog →
          </Link>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[16px] border border-line bg-surface"
          style={{ boxShadow: "0 1px 2px rgba(15,15,15,.035)" }}
        >
          {featured ? <FeaturedRecommendation item={featured} /> : null}
          {rest.length > 0 ? (
            <div className="divide-y divide-[var(--border)]">
              {rest.map((item, index) => (
                <RecommendationRow key={item.id} item={item} index={index + 1} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
