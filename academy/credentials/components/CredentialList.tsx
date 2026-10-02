import Link from "next/link";
import { exploreHref } from "@/academy/explore/utils/query";
import type { CredentialItem } from "../types";
import { CredentialCard } from "./CredentialCard";

const CARD_SHADOW = "0 1px 2px rgba(15,15,15,.04), 0 8px 24px rgba(15,15,15,.035)";

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div
        className="overflow-hidden rounded-[16px] bg-surface"
        style={{ border: "1px solid var(--border)", boxShadow: CARD_SHADOW }}
      >
        <h2
          className="border-b px-5 py-3 text-[13px] font-semibold tracking-[-0.1px] sm:px-5"
          style={{ borderColor: "var(--border)", color: "var(--ink)" }}
        >
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function EmptyRow({
  mark,
  title,
  href,
  linkLabel,
}: {
  mark: string;
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[11px] font-semibold"
        style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
        aria-hidden
      >
        {mark}
      </div>
      <p className="min-w-0 flex-1 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        {title}
      </p>
      <Link
        href={href}
        className="shrink-0 text-[13px] font-medium no-underline hover:text-accent-hover"
        style={{ color: "var(--accent)" }}
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function ItemList({ items }: { items: CredentialItem[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
          <CredentialCard item={item} />
        </li>
      ))}
    </ul>
  );
}

export function CredentialList({
  credentials,
  endorsements,
  certificates,
}: {
  credentials: CredentialItem[];
  endorsements: CredentialItem[];
  certificates: CredentialItem[];
}) {
  return (
    <div className="space-y-4">
      <SectionCard title="Certified Private Attaché">
        {credentials.length === 0 ? (
          <EmptyRow
            mark="CPA"
            title="Not started"
            href="/academy/explore?type=cpa"
            linkLabel="Browse"
          />
        ) : (
          <ItemList items={credentials} />
        )}
      </SectionCard>

      <SectionCard title="Specialty Endorsements">
        {endorsements.length === 0 ? (
          <EmptyRow
            mark="SE"
            title="No specialty endorsements yet"
            href={exploreHref({
              q: "",
              type: "",
              recognition: "specialty_endorsement",
              access: "",
              price: "",
              sort: "sequence",
            })}
            linkLabel="Browse"
          />
        ) : (
          <ItemList items={endorsements} />
        )}
      </SectionCard>

      <SectionCard title="Certificates of Completion">
        {certificates.length === 0 ? (
          <EmptyRow mark="CC" title="None issued yet" href="/academy/explore" linkLabel="Explore" />
        ) : (
          <ItemList items={certificates} />
        )}
      </SectionCard>
    </div>
  );
}
