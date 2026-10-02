"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import {
  generate1099RollupsAction,
  update1099RollupStatusAction,
} from "@/super-admin/partner-center/actions";
import type { Partner1099RollupRow } from "@/partner-center/lib/tax/rollup-1099";
import { PC_ADMIN } from "@/super-admin/partner-center/lib/paths";
import { Tax1099Filters } from "@/super-admin/partner-center/tax-1099/components/Tax1099Filters";
import {
  applyRollupFilters,
  DEFAULT_ROLLUP_FILTERS,
  type RollupFilterState,
} from "@/super-admin/partner-center/tax-1099/lib/filter-rollups";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function Tax1099AdminView({
  taxYear,
  legalPayerEntity,
  rows,
}: {
  taxYear: number;
  legalPayerEntity: string;
  rows: Partner1099RollupRow[];
}) {
  const router = useRouter();
  const [year, setYear] = useState(String(taxYear));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filters, setFilters] =
    useState<RollupFilterState>(DEFAULT_ROLLUP_FILTERS);
  const deferredSearch = useDeferredValue(filters.search);
  const filtered = applyRollupFilters(rows, {
    ...filters,
    search: deferredSearch,
  });

  function goYear(next: number) {
    router.push(`${PC_ADMIN.tax1099}?year=${next}`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-[140px]">
          <Input
            label="Tax year"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            disabled={pending}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            const n = Number(year);
            if (!Number.isFinite(n)) {
              setError("Enter a valid year.");
              return;
            }
            goYear(Math.floor(n));
          }}
        >
          View year
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={pending}
          onClick={() => {
            setError(null);
            setMessage(null);
            const n = Number(year);
            if (!Number.isFinite(n)) {
              setError("Enter a valid year.");
              return;
            }
            startTransition(async () => {
              const result = await generate1099RollupsAction({
                taxYear: Math.floor(n),
              });
              if (result.error) {
                setError(result.error);
                return;
              }
              setMessage(result.message ?? "Generated.");
              goYear(Math.floor(n));
              router.refresh();
            });
          }}
        >
          {pending ? "Working…" : "Generate / refresh rollups"}
        </Button>
      </div>

      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Payer: <strong>{legalPayerEntity}</strong>
      </p>

      {error ? (
        <p className="mb-4 text-[13px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--text-secondary)" }}>
          No rollups for {taxYear} yet. Generate to build totals.
        </p>
      ) : (
        <>
          <Tax1099Filters value={filters} onChange={setFilters} />
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p
                className="m-0 text-[14px] font-semibold"
                style={{ color: "var(--ink)" }}
              >
                No rollups match
              </p>
              <p
                className="m-0 mt-1.5 text-[12.5px]"
                style={{ color: "var(--text-secondary)" }}
              >
                Try clearing search or widening the filters.
              </p>
              <button
                type="button"
                className="mt-4 text-[13px]"
                style={{ color: "var(--accent)" }}
                onClick={() => setFilters(DEFAULT_ROLLUP_FILTERS)}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="pa-partner-card overflow-hidden">
              <table className="w-full border-collapse text-left text-[13.5px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {[
                      "Partner",
                      "Reportable",
                      "Stripe",
                      "Non-Stripe",
                      "Status",
                      "Reference",
                      "",
                    ].map((heading) => (
                      <th
                        key={heading || "actions"}
                        className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.04em]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <RollupRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RollupRow({ row }: { row: Partner1099RollupRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(row.status);
  const [reference, setReference] = useState(row.reference ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td className="px-4 py-3 font-medium">{row.companyName}</td>
      <td className="px-4 py-3">{formatMoney(row.reportableTotal)}</td>
      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
        {formatMoney(row.stripePaidTotal)}
      </td>
      <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
        {formatMoney(row.quickbooksPaidTotal)}
      </td>
      <td className="px-4 py-3">
        <select
          className="rounded-[6px] border border-line bg-white px-2 py-1 text-[12.5px]"
          value={status}
          disabled={pending}
          onChange={(e) =>
            setStatus(e.target.value as Partner1099RollupRow["status"])
          }
        >
          <option value="not_started">Not started</option>
          <option value="in_progress">In progress</option>
          <option value="complete">Complete</option>
          <option value="filed">Filed</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          className="w-full min-w-[120px] rounded-[6px] border border-line bg-white px-2 py-1 text-[12.5px]"
          value={reference}
          disabled={pending}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Filing ref"
        />
        {error ? (
          <p className="mt-1 text-[11.5px]" style={{ color: "#a8433b" }}>
            {error}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <Button
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-[12.5px]"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await update1099RollupStatusAction({
                rollupId: row.id,
                status,
                reference,
              });
              if (result.error) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending ? "…" : "Save"}
        </Button>
      </td>
    </tr>
  );
}
