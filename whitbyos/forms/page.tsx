import { SubmitPlain } from "@/base/components/Submit";
import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Pill } from "@/base/components/Pill";
import { PageHeader } from "@/whitbyos/components/PageHeader";
import { FilterBar } from "@/whitbyos/components/FilterBar";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { Toast } from "@/whitbyos/components/Toast";
import {
  DataTable,
  DataTableCell,
  DataTableRow,
  type Column,
} from "@/whitbyos/components/DataTable";
import {
  NewFormDialog,
  ReviewSubmissionDialog,
} from "@/whitbyos/forms/components/FormDialogs";
import { duplicateForm } from "@/whitbyos/forms/actions";
import { listForms, listSubmissions } from "@/whitbyos/lib/forms";
import { matchesSearch } from "@/whitbyos/lib/search";
import { listClientOptions } from "@/whitbyos/lib/requests";
import { getOpenClientId } from "@/whitbyos/lib/open-client";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { submissionLabel, submissionTone, visibilityLabel, visibilityTone } from "@/whitbyos/lib/form-vocab";
import { shortDate } from "@/whitbyos/lib/format";

const LIST = "/whitbyos/forms";

const SUBMISSION_COLUMNS: Column[] = [
  { label: "Form", width: "2fr" },
  { label: "Client", width: "1.5fr" },
  { label: "Sent To", width: "1.5fr" },
  { label: "Status", width: "1.2fr" },
  { label: "Date", width: "1fr" },
  // The View button's track. Unlabelled: a heading over a column of identical
  // buttons names the button twice and the column not at all.
  { label: "", width: "76px" },
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screens 11 and 11.2, with 11.1 and 11.3 over them. */
export default async function FormsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const submissionsTab = one(searchParams?.tab) === "submissions";
  const q = (one(searchParams?.q) ?? "").trim();
  const adding = one(searchParams?.new) === "1";
  const reviewing = one(searchParams?.review);
  const error = one(searchParams?.error);
  const accepted = one(searchParams?.accepted);
  // Accepting what has come back does not finish a form with questions still
  // blank, and the toast used to say it did.
  const waitingOn = Number(one(searchParams?.waiting) ?? 0) || 0;
  const corrected = one(searchParams?.corrected);
  const duplicated = one(searchParams?.duplicated) === "1";
  /*
   * Whose work this screen is showing is not this screen's question any more.
   * It is chosen once on Workspace Overview and answered the same way
   * everywhere — see `lib/open-client.ts`.
   */
  const client = (await getOpenClientId()) ?? "";
  const showClients = await usesClientWorkspaces();

  const [forms, submissions, clients] = await Promise.all([
    listForms({ client }),
    submissionsTab || reviewing
      ? listSubmissions({ client })
      : Promise.resolve({ ok: true as const, rows: [] }),
    listClientOptions(),
  ]);

  const clientName = clients.find((row) => row.id === client)?.name;
  const inWorkspace = client ? `&client=${encodeURIComponent(client)}` : "";
  const qPart = q ? `&q=${encodeURIComponent(q)}` : "";
  const here = submissionsTab
    ? `${LIST}?tab=submissions${inWorkspace}${qPart}`
    : client
      ? `${LIST}?client=${encodeURIComponent(client)}${q ? `&q=${encodeURIComponent(q)}` : ""}`
      : q
        ? `${LIST}?q=${encodeURIComponent(q)}`
        : LIST;
  const formRows = forms.ok
    ? forms.rows.filter((row) =>
        matchesSearch(q, [row.title, row.category, visibilityLabel(row.visibility)]),
      )
    : [];
  const submissionRows = submissions.ok
    ? submissions.rows.filter((row) =>
        matchesSearch(q, [
          row.formTitle,
          row.clientName,
          row.sentTo,
          row.submittedBy,
          submissionLabel(row.status),
        ]),
      )
    : [];
  const openSubmission = submissions.ok
    ? (submissions.rows.find((row) => row.id === reviewing) ?? null)
    : null;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">

      <PageHeader
        title="Forms"
        size={22}
        gap={20}
        action={
          // 11 draws Quick Add beside New Form, the same 1.1b menu the rail opens.
          <div className="flex items-center gap-2.5">
            <Button
              href={`${LIST}?new=1`}
              variant="primary"
              unsized
              className="px-4 py-[9px] text-[13.5px]"
            >
              + New Form
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex gap-6 border-b border-line">
        {[
          { slug: "", label: "Templates" },
          { slug: "submissions", label: "Submissions" },
        ].map((tab) => {
          const on = tab.slug === (submissionsTab ? "submissions" : "");
          return (
            <Link
              key={tab.label}
              href={
                tab.slug
                  ? `${LIST}?tab=${tab.slug}${inWorkspace}${qPart}`
                  : client
                    ? `${LIST}?client=${encodeURIComponent(client)}${q ? `&q=${encodeURIComponent(q)}` : ""}`
                    : q
                      ? `${LIST}?q=${encodeURIComponent(q)}`
                      : LIST
              }
              className="pb-2.5 text-[13.5px] no-underline"
              style={{
                color: on ? "var(--ink)" : "var(--text-tertiary)",
                fontWeight: on ? 600 : 400,
                borderBottom: on ? "2px solid var(--ink)" : "2px solid transparent",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {forms.ok &&
      (submissionsTab ? submissions.ok && submissions.rows.length > 0 : forms.rows.length > 0) ? (
        <FilterBar
          action={LIST}
          searchPlaceholder={submissionsTab ? "Search submissions…" : "Search forms…"}
          searchValue={q}
          hidden={{
            tab: submissionsTab ? "submissions" : undefined,
            client: client || undefined,
          }}
        />
      ) : null}

      {!forms.ok ? (
        <StateMessage
          glyph="!"
          tone="danger"
          title="Something went wrong"
          description="We couldn't load your Forms. Check your connection and try again, if this keeps happening, contact support."
          action={
            <>
              <Button unsized
                href="mailto:support@privateattache.com?subject=Forms%20failed%20to%20load"
                variant="secondary"
                className="px-4 py-[9px] text-[14px]"
              >
                Contact support
              </Button>
              <Button unsized href={LIST} variant="primary" className="px-[18px] py-[9px] text-[14px]">
                Try again
              </Button>
            </>
          }
        />
      ) : submissionsTab ? (
        submissions.ok && submissions.rows.length > 0 ? (
          submissionRows.length === 0 ? (
            <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Nothing matches “{q}”.
            </p>
          ) : (
          <DataTable columns={showClients ? SUBMISSION_COLUMNS : SUBMISSION_COLUMNS.filter((column) => column.label !== "Client")} rowPadding={13}>
            {submissionRows.map((row) => (
              <DataTableRow
                key={row.id}
                href={`${here}&review=${row.id}`}
                /*
                 * The row has always opened the submission; nothing said so.
                 * A table of five columns of text gives the pointer no reason
                 * to try it, and what is behind it — the answers, and the
                 * accept or send-back on each — is the point of the screen.
                 *
                 * The whole row still works. This is the part you can see.
                 */
                trailing={
                  <Link
                    href={`${here}&review=${row.id}`}
                    className="shrink-0 rounded-control border border-line-strong px-3 py-1.5 text-[12.5px] font-medium no-underline"
                    style={{ background: "var(--surface)", color: "var(--ink)" }}
                  >
                    View
                  </Link>
                }
              >
                <DataTableCell emphasis="strong">{row.formTitle}</DataTableCell>
                {showClients ? <DataTableCell>{row.clientName ?? "No client"}</DataTableCell> : null}
                <DataTableCell>{row.sentTo ?? "Nobody yet"}</DataTableCell>
                <span>
                  <Pill tone={submissionTone(row.status)}>{submissionLabel(row.status)}</Pill>
                </span>
                <DataTableCell emphasis="muted">
                  {row.submittedAt ? shortDate(row.submittedAt) : "Not submitted"}
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTable>
          )
        ) : (
          <StateMessage
            glyph="▧"
            title="No submissions yet"
            description={
              showClients
                ? "When a form is sent to a client and they answer it, their submission lands here for review."
                : "When a form is filled in, the submission lands here for review."
            }
            action={
              <Button unsized href={LIST} variant="primary" className="px-5 py-2.5 text-[13.5px]">
                See your templates
              </Button>
            }
          />
        )
      ) : forms.rows.length === 0 ? (
        <StateMessage
          glyph="▧"
          // A workspace filter that matches nothing was inviting somebody to
          // write their first form while several sat behind the client they had
          // just chosen.
          title={
            clientName ? `Nothing sent to ${clientName}` : "No forms yet"
          }
          description={
            clientName
              ? "No form has been sent to this workspace yet. Choose All clients on Workspace Overview to see every template."
              : "Forms are how you ask something once and keep the answer with the work, an intake questionnaire, a preferences form, a confirmation of receipt."
          }
          action={
            clientName ? (
              <Button unsized href={LIST} variant="secondary" className="px-5 py-2.5 text-[13.5px]">
                Clear filter
              </Button>
            ) : (
              <Button unsized href={`${LIST}?new=1`} variant="primary" className="px-5 py-2.5 text-[13.5px]">
                + New Form
              </Button>
            )
          }
        />
      ) : formRows.length === 0 ? (
        <p className="py-10 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          Nothing matches “{q}”.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-line">
          {formRows.map((form) => (
            <div
              key={form.id}
              className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <Link
                    href={`${LIST}/${form.id}`}
                    className="min-w-0 truncate text-[14px] font-semibold no-underline"
                    style={{ color: "var(--ink)" }}
                  >
                    {form.title}
                  </Link>
                  <Pill tone={visibilityTone(form.visibility)}>
                    {visibilityLabel(form.visibility)}
                  </Pill>
                </span>
                <span
                  className="mt-0.5 block truncate text-[12.5px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {[
                    form.category,
                    `Used on ${form.timesUsed} request${form.timesUsed === 1 ? "" : "s"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>

              <form action={duplicateForm} className="shrink-0">
                <input type="hidden" name="form_id" value={form.id} />
                <SubmitPlain
                 
                  className="rounded-control border border-line-strong px-3 py-1.5 text-[12.5px] font-medium"
                  style={{ background: "var(--surface)", color: "var(--ink)" }}
                >
                  Duplicate
                </SubmitPlain>
              </form>

              {/* The reference draws Duplicate and Edit here and no send
                  anywhere in this file, but a form that cannot be sent is not a
                  form. It sits on the row it belongs to rather than on the
                  builder, where 11.1b draws only Preview and Save Form. */}
              {showClients && form.visibility === "client_visible" ? (
                <Link
                  href={`${LIST}/${form.id}?send=1`}
                  className="shrink-0 rounded-control border border-line-strong px-3 py-1.5 text-[12.5px] font-medium no-underline"
                  style={{ background: "var(--surface)", color: "var(--ink)" }}
                >
                  Send
                </Link>
              ) : null}

              <Link
                href={`${LIST}/${form.id}`}
                className="shrink-0 rounded-control border border-line-strong px-3 py-1.5 text-[12.5px] font-medium no-underline"
                style={{ background: "var(--surface)", color: "var(--ink)" }}
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <NewFormDialog
          forms={forms.ok ? forms.rows.map((row) => ({ id: row.id, title: row.title })) : []}
          closeHref={here}
          error={error}
          showClients={showClients}
        />
      ) : null}

      {openSubmission ? (
        <ReviewSubmissionDialog
          submission={openSubmission}
          closeHref={`${LIST}?tab=submissions`}
          error={error}
        />
      ) : null}

      {accepted ? (
        <Toast
          title={waitingOn > 0 ? "Answers accepted" : "Submission accepted"}
          detail={
            waitingOn > 0
              ? `"${accepted}" is still waiting on the client for ${waitingOn} more.`
              : `"${accepted}" is on file with the client's work.`
          }
          closeHref={here}
        />
      ) : null}

      {corrected ? (
        <Toast
          tone="warning"
          title="Correction requested"
          detail={`"${corrected}" is waiting on the client. Nothing was emailed, no mailbox is connected.`}
          closeHref={here}
        />
      ) : null}

      {duplicated ? (
        <Toast title="Form duplicated" detail="The copy is ready to edit." closeHref={here} />
      ) : null}
    </div>
  );
}
