import Link from "next/link";
import { Callout } from "@/base/components/Callout";
import { ErrorState, PageShell } from "@/academy/components/ui";
import { programCheckoutHref } from "@/academy/enrollment/utils/checkoutHref";
import type { LessonPlayerUnavailableReason } from "../types";

type Copy = {
  title: string;
  body: string;
  href: string;
  link: string;
  retry?: boolean;
};

const COPY: Record<Exclude<LessonPlayerUnavailableReason, "payment_required">, Copy> = {
  no_enrollment: {
    title: "Enrollment required",
    body: "You can only open lessons for programs you are enrolled in.",
    href: "/academy/explore",
    link: "← Back to Explore",
  },
  unpublished: {
    title: "This course is not available",
    body: "This program is no longer in the Academy catalog. Certificates you already earned are still in Certificates & Credentials.",
    href: "/academy/credentials",
    link: "← View certificates",
  },
  not_found: {
    title: "Lesson not available",
    body: "This program or lesson could not be found.",
    href: "/academy/learning",
    link: "← Back to My Learning",
  },
  mismatch: {
    title: "Lesson not available",
    body: "This lesson is not part of the selected program.",
    href: "/academy/learning",
    link: "← Back to My Learning",
  },
  locked: {
    title: "Lesson locked",
    body: "This lesson is locked for your enrollment. Finish the earlier lessons to unlock it.",
    href: "/academy/learning",
    link: "← Back to My Learning",
  },
  empty: {
    title: "No lessons yet",
    body: "This program does not have any lessons to play yet.",
    href: "/academy/learning",
    link: "← Back to My Learning",
  },
  failed: {
    title: "Lesson unavailable",
    body: "This lesson could not be loaded. Your progress has not changed — try again.",
    href: "/academy/learning",
    link: "← Back to My Learning",
    retry: true,
  },
};

export function LessonUnavailable({
  reason,
  programId,
}: {
  reason: LessonPlayerUnavailableReason;
  programId?: string;
}) {
  if (reason === "payment_required") {
    const checkoutHref = programId ? programCheckoutHref(programId) : "/academy/explore";
    return (
      <PageShell>
        <Link
          href={`/academy/explore/${programId ?? ""}`}
          className="text-[13.5px] font-medium no-underline transition-colors hover:text-accent"
          style={{ color: "var(--text-secondary)" }}
        >
          ← Back to program
        </Link>
        <div className="mt-6 max-w-xl">
          <Callout tone="warning" title="Purchase required">
            Complete payment to unlock lessons, assignments, quizzes, and downloads for this
            program.
          </Callout>
          {programId ? (
            <Link
              href={checkoutHref}
              className="mt-4 inline-flex rounded-[6px] px-4 py-2 text-[13.5px] no-underline"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Go to checkout
            </Link>
          ) : null}
        </div>
      </PageShell>
    );
  }

  const copy = COPY[reason];

  return (
    <PageShell>
      <Link
        href={copy.href}
        className="text-[13.5px] font-medium no-underline transition-colors hover:text-accent"
        style={{ color: "var(--text-secondary)" }}
      >
        {copy.link}
      </Link>
      <div className="mt-6 max-w-xl">
        {copy.retry ? (
          <ErrorState title={copy.title} body={copy.body} />
        ) : (
          <Callout tone="warning" title={copy.title}>
            {copy.body}
          </Callout>
        )}
      </div>
    </PageShell>
  );
}
