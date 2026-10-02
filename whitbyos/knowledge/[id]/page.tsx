import { getOpenClient } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { Toast } from "@/whitbyos/components/Toast";
import { updateKnowledgeFile } from "@/whitbyos/knowledge/actions";
import { KNOWLEDGE_CATEGORIES, getKnowledge } from "@/whitbyos/lib/knowledge";
import { shortDate } from "@/whitbyos/lib/format";

const LIST = "/whitbyos/knowledge";
const CONTROL =
  "w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px] text-ink";
/** A quiet line under a field, saying what the field decides. */
const HINT = "mt-1.5 block text-[11.5px] leading-[1.5] text-[var(--text-tertiary)]";

const LABEL = "mb-1.5 block text-[12px] font-medium";

/** Screen 13.1 — one Knowledge file. */
export default async function KnowledgeDetailPage({
  fileId,
  searchParams,
}: {
  fileId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const file = await getKnowledge(fileId);
  if (!file) notFound();
  const showClients = await usesClientWorkspaces();

  /* The client this file already belongs to, or the one open now — a file
     written for the firm can be moved onto the client you are working in. */
  const clientName = showClients ? (await getOpenClient())?.name ?? null : null;

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const here = `${LIST}/${fileId}`;
  const editing = one(searchParams?.edit) === "1";
  const reading = one(searchParams?.view) === "1";
  const error = one(searchParams?.error);
  const saved = one(searchParams?.saved) === "1";
  const created = one(searchParams?.created) === "1";

  const scopeLabel =
    file.scope === "organization" || !showClients
      ? "Organization"
      : file.clientName ?? "Workspace";

  const metaBits = [
    file.category,
    scopeLabel,
    `Updated ${shortDate(file.updatedAt)}`,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-full px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      {/*
       * The way back, as a quiet control — not a second toolbar button.
       */}
      <Link
        href={LIST}
        className="mb-7 inline-flex items-center gap-1.5 text-[13px] font-medium no-underline transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
          &#8592;
        </span>
        Knowledge Base
      </Link>

      {error ? (
        <div className="mb-5 max-w-[720px]">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {/*
       * Masthead on the page; writing on paper.
       *
       * Title and controls belong to the screen. The article body gets a
       * sheet under it — not one floating card holding everything.
       */}
      <div className="mb-7 flex max-w-[720px] items-start justify-between gap-6">
        <div className="flex min-w-0 gap-3.5">
          <span
            aria-hidden
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] text-[15px] font-semibold"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent)",
            }}
          >
            {file.type === "upload" ? "▣" : "≡"}
          </span>
          <div className="min-w-0">
            <h1
              className="text-[26px] font-bold leading-[1.2] tracking-[-0.4px] text-wrap-pretty"
              style={{ color: "var(--ink)" }}
            >
              {file.title}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {metaBits.map((bit) => (
                <span
                  key={bit}
                  className="inline-flex items-center rounded-[5px] px-2 py-[3px] text-[11.5px] font-medium"
                  style={{
                    background: "var(--surface-soft)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--chrome-line)",
                  }}
                >
                  {bit}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center overflow-hidden rounded-[7px] border"
          style={{ borderColor: "var(--chrome-line)", background: "var(--surface)" }}
        >
          {file.type === "upload" ? (
            <Button
              unsized
              href={file.body ?? "#"}
              variant="primary"
              className="rounded-none border-0 px-3.5 py-[7px] text-[13px]"
            >
              View file
            </Button>
          ) : (
            <Link
              href={`${here}?view=1`}
              className="px-3.5 py-[7px] text-[13px] font-medium no-underline transition-colors"
              style={{
                background: "var(--accent)",
                color: "#fff",
              }}
            >
              View
            </Link>
          )}
          <Link
            href={`${here}?edit=1`}
            className="border-l px-3.5 py-[7px] text-[13px] font-medium no-underline transition-colors hover:bg-[var(--surface-soft)]"
            style={{
              borderColor: "var(--chrome-line)",
              color: "var(--ink)",
            }}
          >
            Edit
          </Link>
        </div>
      </div>

      <article
        className="relative max-w-[720px] overflow-hidden rounded-[10px] border"
        style={{
          borderColor: "var(--chrome-line)",
          background: "var(--surface)",
        }}
      >
        {/* Quiet accent edge — marks this as a document, not a dialog. */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: "var(--accent)" }}
        />

        <div className="px-9 py-8 pl-10">
          {file.type === "upload" ? (
            <div className="flex flex-col gap-3">
              <p
                className="text-[14px] leading-[1.65]"
                style={{ color: "var(--text-secondary)" }}
              >
                This file was uploaded rather than written here. Open it with
                View file.
              </p>
              <Button
                unsized
                href={file.body ?? "#"}
                variant="secondary"
                className="w-fit px-3.5 py-[7px] text-[13px]"
              >
                Open uploaded file
              </Button>
            </div>
          ) : (
            /* A measure of about 66 characters: running prose the width of a
               2000px window is how a paragraph becomes unreadable. */
            <div
              className="max-w-[66ch] whitespace-pre-wrap text-[15px] leading-[1.8] text-wrap-pretty"
              style={{ color: "var(--ink)" }}
            >
              {file.body || "Nothing written yet."}
            </div>
          )}
        </div>

        <div
          className="flex items-center gap-2 border-t px-9 py-3.5 pl-10 text-[12px]"
          style={{
            borderColor: "var(--chrome-line)",
            background: "var(--surface-soft)",
            color: "var(--text-tertiary)",
          }}
        >
          <span
            aria-hidden
            className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] text-[10px] font-bold"
            style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
          >
            W
          </span>
          Whitby reads this when drafting Work Plans, tasks, and Ask Whitby answers.
        </div>
      </article>

      {/*
       * Reading view: the article with nothing else on the screen.
       *
       * A cover rather than a modal, because this is a thing to read for ten
       * minutes rather than a question to answer — and the page it covers is
       * still underneath, so Close is one press back to the controls.
       */}
      {reading && file.type !== "upload" ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto"
          style={{
            /* Same soft blue wash as the Whitby sidebar / Ask Whitby panel. */
            background: "linear-gradient(180deg, #ffffff 0%, #f5f9fd 48%, #eef5fc 100%)",
          }}
        >
          <div
            className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-9 py-3.5"
            style={{
              borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
              background: "rgba(255,255,255,.78)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[13px] font-semibold"
                style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
              >
                ≡
              </span>
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-semibold">{file.title}</div>
                <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  {metaBits.join(" · ")}
                </div>
              </div>
            </div>
            <Button unsized href={here} variant="secondary" className="shrink-0 px-3.5 py-[7px] text-[13px]">
              Close
            </Button>
          </div>

          <div className="mx-auto w-full max-w-[920px] px-9 pb-24 pt-10">
            <article
              className="relative min-h-[min(70vh,640px)] overflow-hidden rounded-[12px] border px-5 py-6 sm:px-8 sm:py-10 xl:px-10 pl-11 sm:px-12 sm:py-11 sm:pl-[3.25rem]"
              style={{
                borderColor: "color-mix(in srgb, var(--chrome-line) 85%, #c5ced8)",
                background: "var(--surface)",
                boxShadow: "0 1px 2px rgba(31,72,125,.04)",
              }}
            >
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: "var(--accent)" }}
              />
              <div className="mb-4 flex flex-wrap gap-1.5">
                {metaBits.map((bit) => (
                  <span
                    key={bit}
                    className="inline-flex items-center rounded-[5px] px-2 py-[3px] text-[11.5px] font-medium"
                    style={{
                      background: "var(--surface-soft)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--chrome-line)",
                    }}
                  >
                    {bit}
                  </span>
                ))}
              </div>
              <h2 className="mb-6 text-[28px] font-bold leading-[1.2] tracking-[-0.45px] text-wrap-pretty">
                {file.title}
              </h2>
              {/* Wide enough for long SOPs; still capped so a line doesn't
                  stretch across a whole monitor. */}
              <div
                className="max-w-[78ch] whitespace-pre-wrap text-[15.5px] leading-[1.85] text-wrap-pretty"
                style={{ color: "var(--ink)" }}
              >
                {file.body || "Nothing written yet."}
              </div>
            </article>
          </div>
        </div>
      ) : null}

      {editing ? (
        <Modal title="Edit file" closeHref={here} width={560} dense>
          <form action={updateKnowledgeFile} className="flex flex-col gap-4">
            <input type="hidden" name="file_id" value={fileId} />

            <label className="block">
              <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
                Title
              </span>
              <input
                name="title"
                required
                placeholder="Enter a title"
                defaultValue={file.title}
                className={CONTROL}
              />
            </label>

            <div className="flex gap-3">
              <label className="flex-1">
                <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
                  Category
                </span>
                <select
                  name="category"
                  defaultValue={file.category ?? KNOWLEDGE_CATEGORIES[0]}
                  className={`${CONTROL} text-[13.5px]`}
                >
                  {KNOWLEDGE_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <span className={HINT}>Where it is filed in the library.</span>
              </label>

              {/*
               * The same question, in the same words, as New File.
               *
               * This one still asked for a "Scope" of "This Workspace" or
               * "Organization" — the pair that meant the same thing before 087
               * — so editing a file offered a choice the rest of the product
               * had stopped making.
               */}
              <label className="flex-1">
                <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
                  Who is it for
                </span>
                <select
                  name="scope"
                  defaultValue={file.scope}
                  className={`${CONTROL} text-[13.5px]`}
                >
                  <option value="organization">Organization</option>
                  {showClients && (clientName || file.clientName) ? (
                    <option value="client">
                      Workspace, {file.clientName ?? clientName}
                    </option>
                  ) : null}
                </select>
              </label>
            </div>

            {file.type === "upload" ? (
              <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                The file itself cannot be changed here, upload a new one instead,
                so the old version stays where anything referencing it expects it.
              </p>
            ) : (
              <label className="block">
                <span className={LABEL} style={{ color: "var(--text-secondary)" }}>
                  Content
                </span>
                <textarea
                  name="body"
                  defaultValue={file.body ?? ""}
                  className={`${CONTROL} min-h-[180px] resize-y`}
                />
              </label>
            )}

            <div className="mt-1 flex justify-end gap-2.5">
              <Button unsized href={here} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
                Cancel
              </Button>
              <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
                Save
              </Submit>
            </div>
          </form>
        </Modal>
      ) : null}

      {created ? (
        <Toast title="File saved" detail="It is in your Knowledge library." closeHref={here} />
      ) : null}

      {saved ? <Toast title="File saved" detail="Your changes are in." closeHref={here} /> : null}
    </div>
  );
}
