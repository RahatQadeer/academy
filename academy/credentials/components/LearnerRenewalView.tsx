"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { PageHeader, PageShell, Surface } from "@/academy/components/ui";
import { formatCredentialDate } from "@/academy/credentials/utils/labels";
import type { LearnerRenewalDetail } from "../services/loadLearnerRenewal";
import {
  requestCredentialRenewalAction,
  startRenewalPaymentAction,
  submitRenewalFormAction,
  uploadRenewalAttachmentAction,
} from "../actions";

type AnswerState = Record<
  string,
  { text?: string; attachmentPath?: string; attachmentName?: string }
>;

type Phase = "locked" | "request" | "waiting" | "action" | "complete" | "denied";

function resolvePhase(data: LearnerRenewalDetail): Phase {
  if (data.status === "approved") return "complete";
  if (data.status === "denied") return "denied";
  if (data.canSubmitForm || data.canPay) return "action";
  if (!data.renewalWindowOpen) return "locked";
  if (data.canRequest) return "request";
  return "waiting";
}

export function LearnerRenewalView({
  data,
  flash,
}: {
  data: LearnerRenewalDetail;
  flash?: "paid" | "canceled" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [noteFocused, setNoteFocused] = useState(false);
  const phase = resolvePhase(data);

  const feeLabel = useMemo(() => {
    if (data.paymentAmount == null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (data.paymentCurrency || "usd").toUpperCase(),
    }).format(data.paymentAmount);
  }, [data.paymentAmount, data.paymentCurrency]);

  const termLabel = data.expired
    ? `Expired ${formatCredentialDate(data.expiresAt)}`
    : `Valid through ${formatCredentialDate(data.expiresAt)}`;

  function requestRenewal() {
    setError(null);
    startTransition(async () => {
      const result = await requestCredentialRenewalAction(data.credentialId, message);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function submitForm() {
    if (!data.renewalRequestId) return;
    setError(null);
    startTransition(async () => {
      const payload = data.questions.map((q) => ({
        questionId: q.id,
        answerText: answers[q.id]?.text,
        attachmentPath: answers[q.id]?.attachmentPath,
        attachmentName: answers[q.id]?.attachmentName,
      }));
      const result = await submitRenewalFormAction({
        renewalRequestId: data.renewalRequestId!,
        credentialId: data.credentialId,
        answers: payload,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  function pay() {
    if (!data.renewalRequestId) return;
    setError(null);
    startTransition(async () => {
      const result = await startRenewalPaymentAction(data.renewalRequestId!, data.credentialId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      window.location.href = result.url;
    });
  }

  async function onAttach(questionId: string, file: File | null) {
    if (!file || !data.renewalRequestId) return;
    setError(null);
    const formData = new FormData();
    formData.set("renewalRequestId", data.renewalRequestId);
    formData.set("questionId", questionId);
    formData.set("document", file);
    const result = await uploadRenewalAttachmentAction(formData);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        attachmentPath: result.path,
        attachmentName: result.fileName,
      },
    }));
  }

  return (
    <PageShell>
      <PageHeader
        className="mb-5"
        eyebrow="Outcomes"
        title="Certificate renewal"
        description="Renewal opens on the certificate expiration date. After that day you can request a new three-year term; Academy Admin chooses how to renew."
        actions={
          <Link
            href={`/academy/credentials/${data.credentialId}`}
            className="rounded-[8px] border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink no-underline transition-colors hover:bg-surface-soft"
          >
            Back to certificate
          </Link>
        }
      />

      <div className="flex w-full flex-col gap-4">
        {flash === "paid" ? (
          <Callout tone="success" title="Payment received">
            If payment alone was required, the certificate renews automatically. Otherwise Academy
            Admin will finish review.
          </Callout>
        ) : null}
        {flash === "canceled" ? (
          <Callout tone="warning" title="Checkout canceled">
            No charge was made. You can return to payment when ready.
          </Callout>
        ) : null}

        {/* Process — full width */}
        <Surface elevated className="overflow-hidden">
          <ol className="grid gap-0 sm:grid-cols-3">
            <ProcessStep
              n={1}
              title="You request"
              body="Submit renewal for this awarded certificate."
              state={
                phase === "locked" || phase === "request"
                  ? "current"
                  : phase === "denied"
                    ? "idle"
                    : "done"
              }
            />
            <ProcessStep
              n={2}
              title="Admin decides"
              body="Approve, request information, or require payment (± form)."
              state={
                phase === "waiting" || phase === "action"
                  ? "current"
                  : phase === "complete"
                    ? "done"
                    : "idle"
              }
            />
            <ProcessStep
              n={3}
              title="New term"
              body="Expiration extends three years. Certificate ID unchanged."
              state={phase === "complete" ? "done" : "idle"}
              last
            />
          </ol>
        </Surface>

        {/* Credential + action — side by side, fill the page */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <article
            className="overflow-hidden rounded-[12px] border border-line bg-surface"
            style={{
              boxShadow: "0 1px 2px rgba(15,15,15,.04), 0 12px 32px rgba(15,15,15,.05)",
            }}
          >
            <div
              className="border-b border-line px-5 py-5"
              style={{
                background: data.expired
                  ? "linear-gradient(165deg, var(--warning-bg) 0%, #fff 72%)"
                  : "linear-gradient(165deg, color-mix(in srgb, var(--success-bg) 70%, white) 0%, #fff 72%)",
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <TermPill expired={data.expired} />
                {data.publicId ? (
                  <span className="rounded-[6px] border border-line bg-surface px-2 py-1 font-mono text-[11.5px] font-semibold tracking-[0.05em] text-ink">
                    {data.publicId}
                  </span>
                ) : null}
                {data.statusLabel ? (
                  <span
                    className="rounded-[6px] border border-line bg-surface px-2 py-1 text-[11.5px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {data.statusLabel}
                  </span>
                ) : (
                  <span
                    className="rounded-[6px] border border-line bg-surface px-2 py-1 text-[11.5px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    No renewal on file
                  </span>
                )}
              </div>

              <p
                className="mt-4 text-[12px] font-medium uppercase tracking-[0.05em]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Program
              </p>
              <p className="mt-1 text-[20px] font-bold leading-tight tracking-[-0.35px] text-pretty text-ink sm:text-[22px]">
                {data.programName}
              </p>
              <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                {termLabel}
              </p>
            </div>

            <dl className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <Field
                label="Certificate ID"
                value={data.publicId || "—"}
                mono={Boolean(data.publicId)}
              />
              <Field label="After renewal" value="Same ID · new three-year term" />
            </dl>
          </article>

          <Surface elevated className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.15px] text-ink">
                {phaseTitle(phase)}
              </p>
              <p
                className="mt-1 text-[13px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                {phaseDescription(phase, feeLabel, data)}
              </p>
            </div>

            <div className="flex flex-1 flex-col px-5 py-5">
            {phase === "locked" ? (
              <div className="space-y-3">
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Renewal opens on the certificate expiration date (
                  <span className="font-medium text-ink">{formatCredentialDate(data.expiresAt)}</span>
                  ). Until then, this certificate stays active and Renew stays unavailable.
                </p>
                <Button type="button" variant="primary" disabled>
                  Available {formatCredentialDate(data.expiresAt)}
                </Button>
              </div>
            ) : null}

            {phase === "request" ? (
              <div className="space-y-4">
                <label className="block">
                  <span
                    className="mb-1.5 block text-[12.5px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Note to Academy Admin{" "}
                    <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
                  </span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onFocus={() => setNoteFocused(true)}
                    onBlur={() => setNoteFocused(false)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Context that may help with review…"
                    className="w-full rounded-[6px] border bg-surface px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-[border-color,box-shadow]"
                    style={{
                      borderColor: noteFocused
                        ? "var(--accent)"
                        : "var(--border-strong)",
                      boxShadow: noteFocused ? "0 0 0 3px var(--accent-tint)" : undefined,
                      color: "var(--ink)",
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending}
                  onClick={requestRenewal}
                  className="w-full sm:w-auto"
                >
                  {pending ? "Submitting…" : "Request renewal"}
                </Button>
              </div>
            ) : null}

            {phase === "waiting" ? (
              <div>
                {data.adminNotes ? (
                  <div
                    className="rounded-[8px] border px-4 py-3"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface-soft)",
                    }}
                  >
                    <p
                      className="text-[11.5px] font-semibold uppercase tracking-[0.05em]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Admin note
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">
                      {data.adminNotes}
                    </p>
                  </div>
                ) : (
                  <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    You will be notified when Academy Admin responds or when action is required from
                    you.
                  </p>
                )}
              </div>
            ) : null}

            {phase === "denied" ? (
              <div className="space-y-4">
                {data.adminNotes ? (
                  <div
                    className="rounded-[8px] border px-4 py-3"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface-soft)",
                    }}
                  >
                    <p
                      className="text-[11.5px] font-semibold uppercase tracking-[0.05em]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Admin note
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">
                      {data.adminNotes}
                    </p>
                  </div>
                ) : (
                  <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    This renewal was not approved. Contact Academy Admin if you need guidance on
                    eligibility, or submit a new request below.
                  </p>
                )}
                <label className="block">
                  <span
                    className="mb-1.5 block text-[12.5px] font-medium"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Note to Academy Admin{" "}
                    <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
                  </span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onFocus={() => setNoteFocused(true)}
                    onBlur={() => setNoteFocused(false)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Context for a new review…"
                    className="w-full rounded-[6px] border bg-surface px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-[border-color,box-shadow]"
                    style={{
                      borderColor: noteFocused ? "var(--accent)" : "var(--border-strong)",
                      boxShadow: noteFocused ? "0 0 0 3px var(--accent-tint)" : undefined,
                      color: "var(--ink)",
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="primary"
                  disabled={pending}
                  onClick={requestRenewal}
                  className="w-full sm:w-auto"
                >
                  {pending ? "Submitting…" : "Submit a new request"}
                </Button>
              </div>
            ) : null}

            {phase === "complete" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  This certificate has been renewed. Open the certificate to view the updated term.
                </p>
                <Button href={`/academy/credentials/${data.credentialId}`} variant="primary">
                  View certificate
                </Button>
              </div>
            ) : null}

            {phase === "action" ? (
              <div className="space-y-6">
                {data.canSubmitForm ? (
                  <div className="space-y-4">
                    <p
                      className="text-[12px] font-semibold uppercase tracking-[0.05em]"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Required information
                    </p>
                    {data.questions.map((question) => (
                      <div key={question.id}>
                        <label className="block text-[13px] font-medium text-ink">
                          {question.prompt}
                          {question.required ? (
                            <span style={{ color: "var(--danger-fg)" }}> *</span>
                          ) : null}
                        </label>
                        {question.responseType === "short_answer" ? (
                          <input
                            type="text"
                            value={answers[question.id]?.text ?? ""}
                            onChange={(event) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.id]: {
                                  ...prev[question.id],
                                  text: event.target.value,
                                },
                              }))
                            }
                            className="mt-1.5 h-10 w-full rounded-[6px] border px-3 text-[14px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                            style={{ borderColor: "var(--border-strong)" }}
                          />
                        ) : null}
                        {question.responseType === "long_answer" ? (
                          <textarea
                            value={answers[question.id]?.text ?? ""}
                            onChange={(event) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.id]: {
                                  ...prev[question.id],
                                  text: event.target.value,
                                },
                              }))
                            }
                            rows={4}
                            className="mt-1.5 w-full rounded-[6px] border px-3 py-2.5 text-[14px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-tint)]"
                            style={{ borderColor: "var(--border-strong)" }}
                          />
                        ) : null}
                        {question.responseType === "attachment" ? (
                          <div className="mt-1.5">
                            <input
                              type="file"
                              onChange={(event) =>
                                void onAttach(question.id, event.target.files?.[0] ?? null)
                              }
                              className="block w-full text-[13px]"
                            />
                            {answers[question.id]?.attachmentName ? (
                              <p
                                className="mt-1.5 text-[12.5px]"
                                style={{ color: "var(--text-tertiary)" }}
                              >
                                Attached: {answers[question.id]?.attachmentName}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="primary"
                      disabled={pending}
                      onClick={submitForm}
                      className="w-full sm:w-auto"
                    >
                      {pending ? "Submitting…" : "Submit information"}
                    </Button>
                  </div>
                ) : null}

                {data.canPay ? (
                  <div
                    className={
                      data.canSubmitForm
                        ? "border-t border-line pt-5"
                        : undefined
                    }
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-ink">
                          Renewal fee{feeLabel ? ` · ${feeLabel}` : ""}
                        </p>
                        <p
                          className="mt-0.5 text-[13px] leading-relaxed"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {data.formRequired
                            ? "Pay the fee, then Academy Admin completes review."
                            : "Successful payment renews the certificate automatically."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={pending}
                        onClick={pay}
                        className="shrink-0"
                      >
                        {pending ? "Opening checkout…" : `Pay ${feeLabel ?? "fee"}`}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 text-[13px]" style={{ color: "var(--danger-fg)" }} role="alert">
                {error}
              </p>
            ) : null}
          </div>
          </Surface>
        </div>

        <p className="px-0.5 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
          Only awarded certificates with a defined term can be renewed. Questions about eligibility
          or fees should go to Academy Admin.
        </p>
      </div>
    </PageShell>
  );
}

function phaseTitle(phase: Phase): string {
  switch (phase) {
    case "locked":
      return "Renewal not open yet";
    case "request":
      return "Submit request";
    case "waiting":
      return "With Academy Admin";
    case "action":
      return "Action required";
    case "complete":
      return "Renewal complete";
    case "denied":
      return "Request declined";
  }
}

function phaseDescription(
  phase: Phase,
  feeLabel: string | null,
  data: LearnerRenewalDetail,
): string {
  switch (phase) {
    case "locked":
      return `Available on ${formatCredentialDate(data.expiresAt)}. You can request renewal on or after that day.`;
    case "request":
      return "Admin will choose one path: approve directly, request information, or require payment (with or without a form).";
    case "waiting":
      return data.statusLabel
        ? `${data.statusLabel}. No further action is needed from you yet.`
        : "Your request is with Academy Admin.";
    case "action":
      if (data.canSubmitForm && data.canPay) {
        return "Complete the information below and pay the renewal fee.";
      }
      if (data.canSubmitForm) {
        return "Academy Admin needs the following information before continuing.";
      }
      return "Payment is required to continue this renewal.";
    case "complete":
      return "The credential term has been extended. The public Certificate ID is unchanged.";
    case "denied":
      return data.statusLabel ?? "This renewal request was not approved.";
  }
}

function TermPill({ expired }: { expired: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em]"
      style={{
        background: expired
          ? "color-mix(in srgb, var(--warning-fg) 12%, white)"
          : "var(--success-bg)",
        color: expired ? "var(--warning-fg)" : "var(--success-fg)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "currentColor" }}
        aria-hidden
      />
      {expired ? "Expired" : "Active"}
    </span>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 px-5 py-3.5">
      <dt
        className="text-[11px] font-semibold uppercase tracking-[0.05em]"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </dt>
      <dd
        className={`mt-1 text-[14px] font-medium leading-snug text-pretty text-ink ${
          mono ? "font-mono text-[13px] tracking-[0.04em]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ProcessStep({
  n,
  title,
  body,
  state,
  last,
}: {
  n: number;
  title: string;
  body: string;
  state: "done" | "current" | "idle";
  last?: boolean;
}) {
  const accent =
    state === "done"
      ? "var(--success-fg)"
      : state === "current"
        ? "var(--module-academy-fg)"
        : "var(--text-tertiary)";
  const bg =
    state === "done"
      ? "var(--success-bg)"
      : state === "current"
        ? "color-mix(in srgb, var(--module-academy-fg) 12%, white)"
        : "var(--surface-soft)";

  return (
    <li
      className={`px-5 py-4 ${last ? "" : "border-b border-line sm:border-b-0 sm:border-r"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
          style={{ background: bg, color: accent }}
          aria-hidden
        >
          {state === "done" ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5.5 12.5l4.2 4.2 8.8-9.2"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            n
          )}
        </span>
        <div className="min-w-0">
          <p
            className="text-[13px] font-semibold"
            style={{ color: state === "idle" ? "var(--text-secondary)" : "var(--ink)" }}
          >
            {title}
          </p>
          <p
            className="mt-0.5 text-[12.5px] leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {body}
          </p>
        </div>
      </div>
    </li>
  );
}
