"use client";

import { useState } from "react";
import { CONTROL_UNSIZED } from "@/whitbyos/components/Field";

export type LineDraft = {
  description: string;
  quantity: string;
  rate: string;
};

const BLANK: LineDraft = { description: "", quantity: "1", rate: "" };

/**
 * The body of an invoice: what it is for, how much of it, and at what rate.
 *
 * A running total is shown as it is typed. It is only an echo of what the
 * professional has entered — the number that reaches the client is computed by
 * the database from the stored lines, so this cannot disagree with the invoice
 * even if the arithmetic here is ever wrong.
 *
 * Rows are named as parallel arrays rather than indexed field names, because
 * removing the middle row of five would otherwise leave a gap in the numbering
 * that the action would have to reason about. `getAll` reads them in document
 * order, which is the order they are shown in.
 */
export function InvoiceLines({
  initial,
  currency = "USD",
}: {
  initial?: LineDraft[];
  currency?: string;
}) {
  const [lines, setLines] = useState<LineDraft[]>(
    initial && initial.length > 0 ? initial : [BLANK],
  );

  const set = (index: number, patch: Partial<LineDraft>) =>
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const total = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity);
    const rate = Number(line.rate.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(quantity) || !Number.isFinite(rate)) return sum;
    return sum + Math.round(quantity * rate * 100);
  }, 0);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="grid gap-2 text-[12.5px] font-medium"
        style={{ gridTemplateColumns: "1fr 72px 110px 28px", color: "var(--text-tertiary)" }}
      >
        <span>Description</span>
        <span>Qty</span>
        <span>Rate</span>
        <span />
      </div>

      {lines.map((line, index) => (
        <div
          key={index}
          className="grid items-center gap-2"
          style={{ gridTemplateColumns: "1fr 72px 110px 28px" }}
        >
          <input
            name="line_description"
            value={line.description}
            onChange={(event) => set(index, { description: event.target.value })}
            placeholder="What this covers"
            className={`${CONTROL_UNSIZED} text-[13.5px]`}
          />
          <input
            name="line_quantity"
            value={line.quantity}
            onChange={(event) => set(index, { quantity: event.target.value })}
            inputMode="decimal"
            className={`${CONTROL_UNSIZED} text-[13.5px] tabular-nums`}
          />
          <input
            name="line_rate"
            value={line.rate}
            onChange={(event) => set(index, { rate: event.target.value })}
            inputMode="decimal"
            placeholder="0.00"
            className={`${CONTROL_UNSIZED} text-[13.5px] tabular-nums`}
          />
          {/* The last row keeps its slot rather than losing it, so the columns
              do not shift as rows are added and removed. */}
          {lines.length > 1 ? (
            <button
              type="button"
              onClick={() => setLines((rows) => rows.filter((_, i) => i !== index))}
              aria-label={`Remove line ${index + 1}`}
              className="h-7 w-7 rounded-control border border-line text-[13px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              ✕
            </button>
          ) : (
            <span />
          )}
        </div>
      ))}

      <div className="mt-1 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setLines((rows) => [...rows, { ...BLANK }])}
          className="text-[13px] font-medium"
          style={{ color: "var(--accent)" }}
        >
          + Add a line
        </button>

        <span className="text-[13.5px] font-semibold tabular-nums">
          {(total / 100).toLocaleString("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
}
