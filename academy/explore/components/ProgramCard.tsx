import Link from "next/link";
import type { ExploreProgramCard } from "../types";
import { isFreeProgram } from "../utils/accessState";
import {
  programCardDuration,
  programCardLevel,
  programCardProductKind,
  programCardProvider,
} from "../utils/programCardMeta";
import { programDetailHref } from "../utils/query";
import { ProgramAccessStateControl } from "./ProgramAccessState";
import { ProgramCoverArt } from "./ProgramCover";
import { ProviderRibbon, ProviderRow } from "./ProviderRibbon";

export function ProgramCard({ program }: { program: ExploreProgramCard }) {
  const href = programDetailHref(program.id);
  const provider = programCardProvider(program.type);
  const level = programCardLevel(program.type);
  const productKind = programCardProductKind(program.type);
  const duration = programCardDuration(program.moduleCount);
  const isFree = isFreeProgram(program.price);
  const skills = Array.isArray(program.skillsGained) ? program.skillsGained : [];

  return (
    <article
      className="group academy-learner-card flex h-full flex-col overflow-hidden rounded-[18px] bg-surface"
      style={{
        border: "1px solid var(--border)",
        opacity: program.access.muted ? 0.86 : 1,
      }}
    >
      <div className="relative overflow-hidden">
        <Link href={href} className="block no-underline" tabIndex={-1} aria-hidden>
          {program.coverImageUrl ? (
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface-soft)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={program.coverImageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    "linear-gradient(to top, rgba(15,15,15,0.18) 0%, transparent 45%)",
                }}
              />
            </div>
          ) : (
            <ProgramCoverArt type={program.type} />
          )}
        </Link>

        <ProviderRibbon provider={provider} />

        {program.access.badge ? (
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-transform duration-200 group-hover:-translate-y-px"
            style={{
              background: "rgba(255,255,255,0.94)",
              color: "var(--ink)",
              boxShadow: "0 2px 8px rgba(15,15,15,.1)",
            }}
          >
            {program.access.badge}
          </span>
        ) : isFree ? (
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm transition-transform duration-200 group-hover:-translate-y-px"
            style={{
              background: "rgba(255,255,255,0.94)",
              color: "var(--ink)",
              boxShadow: "0 2px 8px rgba(15,15,15,.1)",
            }}
          >
            Free
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <ProviderRow provider={provider} />

        <h2 className="mt-2 text-[15.5px] font-semibold leading-snug tracking-[-0.18px] text-pretty">
          <Link
            href={href}
            className="text-ink no-underline transition-colors duration-200 hover:text-accent"
          >
            {program.name}
          </Link>
        </h2>

        {skills.length > 0 ? (
          <p
            className="mt-2 line-clamp-2 text-[12.5px] leading-[1.55] text-pretty"
            style={{ color: "var(--text-secondary)" }}
          >
            <span className="font-semibold text-ink">Skills: </span>
            {skills.join(", ")}
          </p>
        ) : program.description ? (
          <p
            className="mt-2 line-clamp-2 text-[12.5px] leading-[1.55] text-pretty"
            style={{ color: "var(--text-secondary)" }}
          >
            {program.description}
          </p>
        ) : null}

        <p
          className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>{level}</span>
          <span aria-hidden>·</span>
          <span>{productKind}</span>
          <span aria-hidden>·</span>
          <span>{duration}</span>
        </p>

        <div className="mt-auto pt-4">
          <ProgramAccessStateControl access={program.access} programId={program.id} fullWidth />
        </div>
      </div>
    </article>
  );
}
