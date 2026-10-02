import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { PageShell } from "@/academy/components/ui";
import { createClient } from "@/base/lib/supabase/server";
import { resolveAcademyAssetUrl } from "@/academy/lib/resolveAcademyAssetUrl";
import { InstructorStatus } from "@/academy/instructor/components/InstructorStatus";
import { InstructorProgramPreview } from "./components/InstructorProgramPreview";
import { loadProgramEditor } from "./services/loadProgramEditor";
import type { EditorLesson, EditorProgram } from "./types";

function BackChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3.5L5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function withPreviewAssets(program: EditorProgram): Promise<EditorProgram> {
  const supabase = await createClient();
  const coverImageUrl = (await resolveAcademyAssetUrl(supabase, program.coverImageUrl)) ?? "";

  const modules = await Promise.all(
    program.modules.map(async (module) => ({
      ...module,
      lessons: await Promise.all(
        module.lessons.map(async (lesson) => {
          const contentUrl = (await resolveAcademyAssetUrl(supabase, lesson.contentUrl)) ?? lesson.contentUrl;
          const resources = await Promise.all(
            lesson.resources.map(async (resource) => ({
              ...resource,
              url: (await resolveAcademyAssetUrl(supabase, resource.url)) ?? resource.url,
            })),
          );
          return { ...lesson, contentUrl, resources } satisfies EditorLesson;
        }),
      ),
    })),
  );

  return { ...program, coverImageUrl, modules };
}

export async function InstructorProgramPreviewPage({
  userId,
  programId,
}: {
  userId: string;
  programId: string;
}) {
  const result = await loadProgramEditor(userId, programId);

  if (!result.ok) {
    return (
      <PageShell>
        <Callout tone="warning" title="Preview unavailable">
          This draft could not be loaded.
        </Callout>
      </PageShell>
    );
  }

  const program = await withPreviewAssets(result.data);
  const lessonCount = program.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const modulesLabel = program.modules.length === 1 ? "1 module" : `${program.modules.length} modules`;
  const lessonsLabel = lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;

  return (
    <PageShell>
      <div className="space-y-6">
        <Link
          href={`/academy/instructor/programs/${program.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium no-underline hover:text-accent-hover"
          style={{ color: "var(--text-secondary)" }}
        >
          <BackChevron />
          Back to editor
        </Link>

        {program.coverImageUrl ? (
          <div
            className="overflow-hidden rounded-[12px] bg-surface"
            style={{
              border: "1px solid var(--border)",
              boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={program.coverImageUrl}
              alt=""
              className="aspect-[21/9] w-full object-cover sm:aspect-[2.4/1]"
            />
          </div>
        ) : null}

        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-[24px] font-bold leading-[1.2] tracking-[-0.4px] text-pretty sm:text-[26px]">
              {program.name.trim() || "Untitled program"}
            </h1>
            <p className="mt-2 text-[14px] leading-[1.65] text-pretty" style={{ color: "var(--text-secondary)" }}>
              {program.description.trim() || "No description yet."}
            </p>
            <p className="mt-2 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {modulesLabel} · {lessonsLabel} · Preview only — this does not publish the program.
            </p>
          </div>
          <InstructorStatus
            programStatus={program.status}
            publishRequestStatus={program.latestRequestStatus}
          />
        </header>

        <InstructorProgramPreview program={program} />
      </div>
    </PageShell>
  );
}
