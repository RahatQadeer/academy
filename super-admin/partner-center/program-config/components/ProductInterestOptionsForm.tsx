"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/base/components/Button";
import { Input } from "@/base/components/Input";
import { Checkbox } from "@/partner-center/components/Checkbox";
import { saveProductInterestOptionsAction } from "@/super-admin/partner-center/actions";
import { AdminDetailSection } from "@/super-admin/partner-center/components/AdminDetailSections";
import { slugifyProductInterestLabel } from "@/partner-center/opportunities/lib/product-interest-shared";
import type { AdminProductInterestOption } from "@/super-admin/partner-center/services/saveProductInterestOptions";

type DraftOption = {
  key: string;
  id?: string;
  value: string;
  label: string;
  sortOrder: string;
  active: boolean;
};

function toDraft(options: AdminProductInterestOption[]): DraftOption[] {
  return options.map((option, index) => ({
    key: option.id || `row-${index}`,
    id: option.id.startsWith("default-") ? undefined : option.id,
    value: option.value,
    label: option.label,
    sortOrder: String(option.sortOrder),
    active: option.active,
  }));
}

export function ProductInterestOptionsForm({
  initial,
}: {
  initial: AdminProductInterestOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftOption[]>(() => toDraft(initial));

  function updateRow(key: string, patch: Partial<DraftOption>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    const nextOrder =
      rows.reduce((max, row) => Math.max(max, Number(row.sortOrder) || 0), 0) +
      10;
    setRows((current) => [
      ...current,
      {
        key: `new-${Date.now()}`,
        value: "",
        label: "",
        sortOrder: String(nextOrder),
        active: true,
      },
    ]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveProductInterestOptionsAction({
        options: rows.map((row) => ({
          id: row.id,
          value: row.value.trim() || slugifyProductInterestLabel(row.label),
          label: row.label,
          sortOrder: Number(row.sortOrder),
          active: row.active,
        })),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.message ?? "Saved.");
      router.refresh();
    });
  }

  return (
    <AdminDetailSection title="Opportunity product interest" variant="form">
      <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
        Choices partners see when submitting an opportunity.
      </p>

      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="pa-partner-card p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Label"
                value={row.label}
                onChange={(e) => {
                  const label = e.target.value;
                  updateRow(row.key, {
                    label,
                    value:
                      row.id || row.value
                        ? row.value
                        : slugifyProductInterestLabel(label),
                  });
                }}
                disabled={pending}
              />
              <Input
                label="Value (slug)"
                value={row.value}
                onChange={(e) =>
                  updateRow(row.key, {
                    value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                  })
                }
                disabled={pending || Boolean(row.id)}
                hint={
                  row.id
                    ? "Slug is locked after save."
                    : "Lowercase letters, numbers, underscores."
                }
              />
              <Input
                label="Sort order"
                inputMode="numeric"
                value={row.sortOrder}
                onChange={(e) => updateRow(row.key, { sortOrder: e.target.value })}
                disabled={pending}
              />
              <div className="flex items-end pb-1">
                <Checkbox
                  checked={row.active}
                  onChange={(checked) => updateRow(row.key, { active: checked })}
                >
                  Active
                </Checkbox>
              </div>
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                disabled={pending || rows.length <= 1}
                onClick={() => removeRow(row.key)}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="secondary" disabled={pending} onClick={addRow}>
          Add option
        </Button>
        <Button type="button" variant="primary" disabled={pending} onClick={submit}>
          {pending ? "Saving…" : "Save product interests"}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 text-[13px]" style={{ color: "#a8433b" }}>
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>
      ) : null}
    </AdminDetailSection>
  );
}
