"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminCredentialFilters } from "../utils/filters";
import { credentialsHref } from "../utils/filters";
import { FilterSelect } from "@/academy/components/ui/FilterSelect";

const fieldClass =
  "h-9 w-full rounded-[8px] border border-line-strong bg-surface px-3 text-[13.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[rgba(55,53,47,0.35)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)] disabled:opacity-60";

const PREFETCH_VIEWS: AdminCredentialFilters["view"][] = ["pending", "awarded", "expired", "all"];

export function CredentialFilters({ filters }: { filters: AdminCredentialFilters }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    for (const view of PREFETCH_VIEWS) {
      if (view === filters.view) continue;
      router.prefetch(credentialsHref({ ...filters, view, search: "" }));
    }
  }, [filters, router]);

  function go(next: Partial<AdminCredentialFilters>) {
    startTransition(() => {
      router.push(credentialsHref({ ...filters, ...next }));
    });
  }

  return (
    <form
      className="grid gap-3 md:grid-cols-4"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        go({ search: String(form.get("q") ?? "") });
      }}
    >
      <label className="block min-w-0 md:col-span-2">
        <span
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Search learner or credential
        </span>
        <input
          name="q"
          defaultValue={filters.search}
          placeholder="Name or program"
          className={fieldClass}
          disabled={pending}
        />
      </label>

      <FilterSelect
        label="List"
        value={filters.view}
        disabled={pending}
        onChange={(value) => go({ view: value as AdminCredentialFilters["view"] })}
        options={[
          { value: "pending", label: "Pending review" },
          { value: "awarded", label: "Awarded" },
          { value: "expired", label: "Expired" },
          { value: "all", label: "All credentials" },
        ]}
      />

      <FilterSelect
        label="Certificate type"
        value={filters.type}
        disabled={pending}
        onChange={(value) => go({ type: value as AdminCredentialFilters["type"] })}
        options={[
          { value: "all", label: "All types" },
          { value: "cpa_credential", label: "Certified Private Attaché" },
          { value: "certificate_of_completion", label: "Certificate of Completion" },
          { value: "specialty_endorsement", label: "Specialty Endorsement" },
        ]}
      />

      {pending ? (
        <p className="md:col-span-4 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Loading list…
        </p>
      ) : null}
    </form>
  );
}
