import Link from "next/link";
import { LearnerHero } from "@/academy/components/learner/LearnerHero";

export function DashboardHeader({ displayName }: { displayName: string }) {
  const name = displayName.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="academy-desk-reveal">
      <LearnerHero
        eyebrow="Academy · Studio"
        title={name ? `Welcome back, ${name}` : "Welcome back"}
        description="Pick up a program, or open the catalog for your next credential."
        trailing={
          <Link
            href="/academy/explore"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold text-white no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px"
            style={{ background: "var(--ink)", boxShadow: "0 8px 20px rgba(55,53,47,0.16)" }}
          >
            Explore catalog
            <span aria-hidden>→</span>
          </Link>
        }
      />
    </div>
  );
}
