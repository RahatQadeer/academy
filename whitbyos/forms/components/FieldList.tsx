"use client";

import { useState } from "react";
import { FIELD_TYPES, fieldTypeLabel, type FormField } from "@/whitbyos/lib/form-vocab";
import { useMarkDirty } from "@/whitbyos/forms/components/SaveForm";

let seq = 0;
const nextId = () => `new-${Date.now()}-${seq++}`;

/**
 * Screen 11.1b's field list.
 *
 * The reference lists each field as a line — what it asks, and under it the
 * type and whether it is required — with a small Edit beside it. Every field
 * was an open row of inputs before, which turned a form of eight questions into
 * a wall of controls and made the list impossible to read at a glance.
 *
 * Edit opens the row in place rather than a dialog. The inputs are already on
 * this page and already submit with it; lifting three of them into a modal
 * would mean either a second save or a modal editing the state behind itself.
 *
 * Everything still submits with the form. A field that saved on its own would
 * leave a half-edited form behind whenever someone closed the page mid-thought,
 * which is worse than losing an unsaved change they know they made.
 *
 * The export draws a drag handle. Reordering is up and down arrows instead:
 * both move a field, only one works from a keyboard and on a touchscreen.
 */
export function FieldList({ initial }: { initial: FormField[] }) {
  const [fields, setFields] = useState<FormField[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  // Typing raises its own events; adding, removing and reordering do not.
  const markDirty = useMarkDirty();

  function update(index: number, patch: Partial<FormField>) {
    setFields((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= fields.length) return;
    markDirty();
    setFields((rows) => {
      const copy = [...rows];
      const [taken] = copy.splice(index, 1);
      copy.splice(to, 0, taken!);
      return copy;
    });
  }

  function add() {
    const id = nextId();
    markDirty();
    setFields((rows) => [...rows, { id, label: "", type: "short", required: false }]);
    // A new field has nothing in it, so it opens. Closed, it would be a row
    // reading "Untitled field" that nobody had asked for.
    setOpen(id);
  }

  return (
    <div>
      <h2 className="mb-3 text-[14px] font-semibold">Fields ({fields.length})</h2>

      <div className="flex flex-col gap-2">
        {fields.map((field, index) => {
          const editing = open === field.id;

          return (
            <div
              key={field.id}
              className="rounded-[8px] border border-line px-4 py-3"
              style={{ background: "var(--surface)" }}
            >
              <input type="hidden" name="field_id" value={field.id} />
              <input type="hidden" name="field_required" value={field.required ? "1" : "0"} />
              {/* A closed row still has to submit what it holds, and the open
                  one submits from its own inputs, so exactly one of the two
                  carries each value and the order never doubles up. */}
              {editing ? null : <input type="hidden" name="field_label" value={field.label} />}
              {editing ? null : <input type="hidden" name="field_type" value={field.type} />}

              <div className="flex items-center gap-2.5">
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                    className="px-1 text-[10px] leading-none disabled:opacity-30"
                    style={{ color: "var(--text-disabled)" }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === fields.length - 1}
                    aria-label="Move down"
                    className="px-1 text-[10px] leading-none disabled:opacity-30"
                    style={{ color: "var(--text-disabled)" }}
                  >
                    ▼
                  </button>
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {field.label || "Untitled field"}
                  </span>
                  <span className="block text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                    {fieldTypeLabel(field.type)}
                    {field.required ? " · Required" : ""}
                  </span>
                </span>

                {/* Blue is the open state, not the resting one. 11.1b draws
                    every Edit in the accent colour, which on a form of eight
                    fields is eight blue buttons all claiming attention and none
                    of them saying which row is actually open. Quiet until
                    pressed; the accent then marks the one being edited. */}
                <button
                  type="button"
                  onClick={() => setOpen(editing ? null : field.id)}
                  title={editing ? "Finish editing" : "Edit field"}
                  aria-expanded={editing}
                  className="shrink-0 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium"
                  style={
                    editing
                      ? { borderColor: "var(--accent)", color: "var(--accent)" }
                      : { borderColor: "var(--border-strong)", color: "var(--text-secondary)" }
                  }
                >
                  {editing ? "Done" : "Edit"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    markDirty();
                    setFields((rows) => rows.filter((_, i) => i !== index));
                    if (editing) setOpen(null);
                  }}
                  title="Remove field"
                  aria-label={`Remove ${field.label || "field"}`}
                  className="shrink-0 px-1 text-[12px]"
                  style={{ color: "var(--text-disabled)" }}
                >
                  ✕
                </button>
              </div>

              {editing ? (
                <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-line pt-3">
                  <input
                    name="field_label"
                    value={field.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                    placeholder="What are you asking?"
                    aria-label="Field label"
                    autoFocus
                    className="min-w-0 flex-1 rounded-control border border-line-strong bg-surface px-2.5 py-[7px] text-[13.5px]"
                  />

                  <select
                    name="field_type"
                    value={field.type}
                    onChange={(event) => update(index, { type: event.target.value })}
                    aria-label="Field type"
                    className="shrink-0 rounded-control border border-line-strong bg-surface px-2 py-[7px] text-[12.5px]"
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>

                  <label className="flex shrink-0 items-center gap-1.5 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => update(index, { required: event.target.checked })}
                      className="h-[14px] w-[14px]"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    Required
                  </label>
                </div>
              ) : null}
            </div>
          );
        })}

        {/* 11.1b draws this as the last row of the list, full width and dashed,
            rather than as a link above it, so a field is added where it will
            appear. */}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-2.5 rounded-[8px] border border-dashed px-4 py-3.5 text-left"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-tertiary)" }}
        >
          <span className="text-[14px]">+</span>
          <span className="text-[13.5px]">Add a field</span>
        </button>
      </div>
    </div>
  );
}
