"use client";

import { useState } from "react";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { createKnowledgeFile } from "@/whitbyos/knowledge/actions";

const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink";
const LABEL = "mb-1.5 block text-[12px] font-medium";

/**
 * Screens 13.2 and 13.2b — New File.
 *
 * One dialog with two modes, as the export draws them: Write and Upload File
 * are a toggle on the same form, not two different dialogs, because the title,
 * category and scope are the same question either way.
 */
/** A quiet line under a field, saying what the field decides. */
const HINT = "mt-1.5 block text-[11.5px] leading-[1.5] text-[var(--text-tertiary)]";

export function NewFileDialog({
  categories,
  clientName,
  closeHref,
  error,
}: {
  categories: string[];
  /** The client workspace that is open, when one is. */
  clientName?: string | null;
  closeHref: string;
  error?: string;
}) {
  const [mode, setMode] = useState<"write" | "upload">("write");

  return (
    <Modal title="New File" closeHref={closeHref} width={520} dense>
      <form action={createKnowledgeFile} className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <label className="block">
          <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
            Title
          </span>
          <input
            name="title"
            required
            placeholder="Enter a title"
            className={CONTROL}
          />
        </label>

        <div className="flex gap-3">
          <label className="flex-1">
            <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
              Category
            </span>
            <select name="category" defaultValue={categories[0]} className={`${CONTROL} text-[13.5px]`}>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {/*
             * A line under the field it is about, rather than a paragraph
             * under both.
             *
             * The explanation used to run four lines with three phrases in
             * bold, which is a page of small print where two short sentences
             * do — and bolding the words a reader is already looking at makes
             * the sentence harder to read, not easier.
             */}
            <span className={HINT}>Where it is filed in the library.</span>
          </label>

          <label className="flex-1">
            <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
              Who is it for
            </span>
            {/*
             * The two answers now differ.
             *
             * It read "Scope: This Workspace / Organization", and both meant
             * the firm's own library — nothing treated one differently from
             * the other, so somebody filing a client's visa notes under "This
             * Workspace" believed they were kept apart when they were not.
             */}
            <select
              name="scope"
              defaultValue="organization"
              className={`${CONTROL} text-[13.5px]`}
            >
              <option value="organization">Organization</option>
              {clientName ? (
                <option value="client">Workspace, {clientName}</option>
              ) : null}
            </select>
          </label>
        </div>

        <div>
          <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
            Content
          </span>

          <div
            className="mb-2.5 flex gap-0.5 rounded-[8px] p-0.5"
            style={{ background: "var(--canvas)" }}
          >
            {(["write", "upload"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className="flex-1 rounded-[6px] py-1.5 text-center text-[12.5px]"
                style={
                  mode === option
                    ? {
                        background: "var(--surface)",
                        color: "var(--ink)",
                        fontWeight: 600,
                        boxShadow: "0 1px 2px rgba(15,15,15,.08)",
                      }
                    : { color: "var(--text-secondary)", fontWeight: 500 }
                }
              >
                {option === "write" ? "Write" : "Upload File"}
              </button>
            ))}
          </div>

          {mode === "write" ? (
            <textarea
              name="body"
              className={`${CONTROL} min-h-[150px] resize-y`}
              placeholder="Write the article content…"
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <input type="file" name="file" className={`${CONTROL} py-2`} />
              {/* 13.2b names what it takes, which is the difference between a
                  file that will not upload and one nobody knew not to pick. */}
              <span className="text-[11.5px]" style={{ color: "var(--text-quiet)" }}>
                PDF, DOCX, XLSX up to 25MB
              </span>
            </div>
          )}
        </div>

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Save File
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
