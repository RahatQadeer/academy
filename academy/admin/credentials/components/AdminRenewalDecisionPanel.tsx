"use client";

import { useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { PageHeader, PageShell, Surface } from "@/academy/components/ui";
import { formatCredentialDate } from "../lib/format";
import type { AdminRenewalDetail } from "../services/loadAdminRenewals";
import { decideRenewalRequestAction, denyRenewalRequestAction } from "../actions";
import type { RenewalQuestionType } from "@/academy/lib/credentialRenewal/types";

type DraftQuestion = {
  key: string;
  prompt: string;
  responseType: RenewalQuestionType;
  required: boolean;
};

type PathId = "approve" | "info" | "pay" | "pay_form";

const PATHS: {
  id: PathId;
  option: string;
  title: string;
  body: string;
}[] = [
  {
    id: "approve",
    option: "Option 1",
    title: "Approve directly",
    body: "Renew immediately. Extends the expiration by three years. Certificate ID stays the same.",
  },
  {
    id: "info",
    option: "Option 2",
    title: "Request information",
    body: "Send a custom form to the learner. After they submit, you review and approve or deny.",
  },
  {
    id: "pay",
    option: "Option 3a",
    title: "Payment only",
    body: "Require the program renewal fee. Successful payment renews the certificate automatically.",
  },
  {
    id: "pay_form",
    option: "Option 3b",
    title: "Payment + form",
    body: "Require the fee and a custom form. After both are complete, you review and approve.",
  },
];

export function AdminRenewalDecisionPanel({ detail }: { detail: AdminRenewalDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<PathId>("approve");
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    { key: "q1", prompt: "", responseType: "short_answer", required: true },
  ]);

  const feeLabel =
    detail.programPrice != null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
          detail.programPrice,
        )
      : null;
  const paymentDisabled = !feeLabel;

  function run(path: "approve_direct" | "request_info" | "require_payment" | "require_payment_and_form") {
    setError(null);
    startTransition(async () => {
      const result = await decideRenewalRequestAction({
        renewalRequestId: detail.id,
        credentialId: detail.credentialId,
        path,
        notes,
        questions:
          path === "request_info" || path === "require_payment_and_form"
            ? questions.map((q) => ({
                prompt: q.prompt,
                responseType: q.responseType,
                required: q.required,
              }))
            : undefined,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function deny() {
    setError(null);
    startTransition(async () => {
      const result = await denyRenewalRequestAction({
        renewalRequestId: detail.id,
        credentialId: detail.credentialId,
        notes,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  if (!detail.canDecide && !detail.canApproveAfterReview) {
    return (
      <Surface elevated className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Decision</h2>
        </div>
        <div className="px-5 py-5">
          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Status: {detail.statusLabel}. Waiting on the learner
            {detail.paymentRequired ? " (payment)" : ""}
            {detail.formRequired ? " (form)" : ""}. No admin action until they complete their step.
          </p>
        </div>
      </Surface>
    );
  }

  if (detail.canApproveAfterReview) {
    return (
      <Surface elevated className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Review learner submission</h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            The learner completed the required steps. Approve to extend the term, or deny.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <NotesField value={notes} onChange={setNotes} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => run("approve_direct")}
            >
              {pending ? "Approving…" : "Approve renewal"}
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={deny}>
              Deny
            </Button>
          </div>
          {error ? (
            <p className="text-[13px]" style={{ color: "var(--danger-fg)" }}>
              {error}
            </p>
          ) : null}
        </div>
      </Surface>
    );
  }

  return (
    <Surface elevated className="overflow-hidden">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold text-ink">Choose how to renew</h2>
        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Pick one path for this learner. The Certificate ID never changes — only the expiration
          term is extended when renewal completes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2">
        {PATHS.map((path) => {
          const selected = mode === path.id;
          const disabled =
            (path.id === "pay" || path.id === "pay_form") && paymentDisabled;
          return (
            <button
              key={path.id}
              type="button"
              disabled={disabled}
              onClick={() => setMode(path.id)}
              className="rounded-[10px] border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: selected ? "var(--accent)" : "var(--border)",
                background: selected ? "var(--accent-tint)" : "var(--surface)",
                boxShadow: selected ? "0 0 0 1px var(--accent)" : undefined,
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: selected ? "var(--accent)" : "var(--text-tertiary)" }}
              >
                {path.option}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{path.title}</p>
              <p
                className="mt-1 text-[12.5px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {path.body}
                {disabled ? " Configure a program price first." : ""}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-4 px-5 py-5">
        <div
          className="rounded-[8px] border px-3.5 py-3"
          style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
        >
          <p className="text-[13px] font-semibold text-ink">
            {PATHS.find((p) => p.id === mode)?.title}
          </p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
            {PATHS.find((p) => p.id === mode)?.body}
          </p>
        </div>

        <NotesField value={notes} onChange={setNotes} />

        {(mode === "info" || mode === "pay_form") && (
          <FormBuilder questions={questions} setQuestions={setQuestions} />
        )}

        {(mode === "pay" || mode === "pay_form") && (
          <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {feeLabel
              ? `Renewal fee charged to the learner: ${feeLabel} (program price).`
              : "This program has no price — use Option 1 or Option 2 instead."}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {mode === "approve" ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => run("approve_direct")}
            >
              {pending ? "Approving…" : "Approve renewal now"}
            </Button>
          ) : null}
          {mode === "info" ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => run("request_info")}
            >
              {pending ? "Sending…" : "Send information request"}
            </Button>
          ) : null}
          {mode === "pay" ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending || paymentDisabled}
              onClick={() => run("require_payment")}
            >
              {pending ? "Saving…" : "Require payment"}
            </Button>
          ) : null}
          {mode === "pay_form" ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending || paymentDisabled}
              onClick={() => run("require_payment_and_form")}
            >
              {pending ? "Saving…" : "Require payment + form"}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" disabled={pending} onClick={deny}>
            Deny request
          </Button>
        </div>

        {error ? (
          <p className="text-[13px]" style={{ color: "var(--danger-fg)" }}>
            {error}
          </p>
        ) : null}
      </div>
    </Surface>
  );
}

function NotesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span
        className="mb-1.5 block text-[12.5px] font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        Note to learner <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder="Shown on the learner’s renewal page…"
        className="w-full rounded-[6px] border px-3 py-2.5 text-[14px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
        style={{ borderColor: "var(--border-strong)" }}
      />
    </label>
  );
}

function FormBuilder({
  questions,
  setQuestions,
}: {
  questions: DraftQuestion[];
  setQuestions: Dispatch<SetStateAction<DraftQuestion[]>>;
}) {
  return (
    <div className="space-y-3 rounded-[10px] border border-line px-4 py-4">
      <div>
        <p className="text-[13px] font-semibold text-ink">Form questions</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Add as many as you need. Short answer, long answer, or attachment.
        </p>
      </div>
      {questions.map((question, index) => (
        <div key={question.key} className="space-y-2 rounded-[8px] bg-[var(--surface-soft)] p-3">
          <input
            type="text"
            value={question.prompt}
            onChange={(event) =>
              setQuestions((prev) =>
                prev.map((q, i) => (i === index ? { ...q, prompt: event.target.value } : q)),
              )
            }
            placeholder={`Question ${index + 1}`}
            className="h-9 w-full rounded-[6px] border px-2.5 text-[13.5px] outline-none focus:border-accent"
            style={{ borderColor: "var(--border-strong)" }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={question.responseType}
              onChange={(event) =>
                setQuestions((prev) =>
                  prev.map((q, i) =>
                    i === index
                      ? { ...q, responseType: event.target.value as RenewalQuestionType }
                      : q,
                  ),
                )
              }
              className="h-9 rounded-[6px] border bg-surface px-2 text-[13px]"
              style={{ borderColor: "var(--border-strong)" }}
            >
              <option value="short_answer">Short answer</option>
              <option value="long_answer">Long answer</option>
              <option value="attachment">Attachment</option>
            </select>
            <label
              className="inline-flex items-center gap-1.5 text-[12.5px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <input
                type="checkbox"
                checked={question.required}
                onChange={(event) =>
                  setQuestions((prev) =>
                    prev.map((q, i) =>
                      i === index ? { ...q, required: event.target.checked } : q,
                    ),
                  )
                }
              />
              Required
            </label>
            {questions.length > 1 ? (
              <button
                type="button"
                className="border-0 bg-transparent p-0 text-[12.5px]"
                style={{ color: "var(--danger-fg)" }}
                onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          setQuestions((prev) => [
            ...prev,
            {
              key: `q${prev.length + 1}-${Date.now()}`,
              prompt: "",
              responseType: "short_answer",
              required: true,
            },
          ])
        }
      >
        Add question
      </Button>
    </div>
  );
}

export function AdminRenewalDetailView({ detail }: { detail: AdminRenewalDetail }) {
  return (
    <PageShell>
      <PageHeader
        className="mb-5"
        eyebrow="Certificates & Credentials"
        title={detail.programName}
        description={`${detail.learnerName}${detail.learnerEmail ? ` · ${detail.learnerEmail}` : ""}${
          detail.expiresAt ? ` · expires ${formatCredentialDate(detail.expiresAt)}` : ""
        }`}
        actions={
          <Link
            href="/academy/admin/credentials/renewals"
            className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink no-underline hover:bg-surface-soft"
          >
            ← All renewal requests
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill tone="accent">{detail.statusLabel}</Pill>
        {detail.publicId ? (
          <span className="rounded-[6px] border border-line bg-surface px-2 py-1 font-mono text-[11.5px] font-semibold tracking-[0.04em]">
            {detail.publicId}
          </span>
        ) : null}
        {detail.formRequired ? <Pill tone="neutral">Form</Pill> : null}
        {detail.paymentRequired ? <Pill tone="neutral">Payment</Pill> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          {detail.learnerMessage ? (
            <Surface elevated className="overflow-hidden">
              <div className="border-b border-line px-5 py-3.5">
                <p
                  className="text-[11.5px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  Learner note
                </p>
              </div>
              <p className="whitespace-pre-wrap px-5 py-4 text-[13.5px] leading-relaxed text-ink">
                {detail.learnerMessage}
              </p>
            </Surface>
          ) : (
            <Surface padded elevated>
              <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
                The learner did not leave a note with this request.
              </p>
            </Surface>
          )}

          {detail.answers.length > 0 ? (
            <Surface elevated className="overflow-hidden">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="text-[14px] font-semibold text-ink">Submitted information</h2>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {detail.answers.map((answer) => (
                  <li key={answer.questionId} className="px-5 py-3.5">
                    <p
                      className="text-[12px] font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {answer.prompt}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink">
                      {answer.responseType === "attachment"
                        ? answer.attachmentName || "Attachment on file"
                        : answer.answerText || "—"}
                    </p>
                  </li>
                ))}
              </ul>
            </Surface>
          ) : null}

          <Button
            href={`/academy/admin/credentials/${detail.credentialId}/awarded`}
            variant="secondary"
          >
            Open certificate record
          </Button>
        </div>

        <AdminRenewalDecisionPanel detail={detail} />
      </div>
    </PageShell>
  );
}
