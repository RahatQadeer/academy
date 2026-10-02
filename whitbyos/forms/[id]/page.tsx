import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Toast } from "@/whitbyos/components/Toast";
import { BackLink } from "@/whitbyos/components/BackLink";
import { FieldList } from "@/whitbyos/forms/components/FieldList";
import {
  BuilderActions,
  FormDirtyProvider,
} from "@/whitbyos/forms/components/SaveForm";
import { SendFormDialog } from "@/whitbyos/forms/components/FormDialogs";
import { PreviewFormDialog } from "@/whitbyos/forms/components/PreviewFormDialog";
import { saveForm } from "@/whitbyos/forms/actions";
import { getForm, listClientContacts } from "@/whitbyos/lib/forms";
import { listClientOptions, listRequests } from "@/whitbyos/lib/requests";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import {
  FIELD_TYPES,
  FORM_CATEGORIES,
  FORM_VISIBILITY,
  visibilityLabel,
  visibilityTone,
} from "@/whitbyos/lib/form-vocab";

const LIST = "/whitbyos/forms";

/** Screen 11.1b — the Form Builder, with 11.1c after saving. */
export default async function FormBuilderPage({
  formId,
  searchParams,
}: {
  formId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const form = await getForm(formId);
  if (!form) notFound();

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const here = `${LIST}/${formId}`;
  const saved = one(searchParams?.saved) === "1";
  const created = one(searchParams?.created) === "1";
  const sent = one(searchParams?.sent) === "1";
  const sending = one(searchParams?.send) === "1";
  const previewing = one(searchParams?.preview) === "1";
  const settingsOpen = one(searchParams?.settings) === "1";
  const error = one(searchParams?.error);
  const showClients = await usesClientWorkspaces();

  const [clients, requestsResult, contacts] = sending
    ? await Promise.all([listClientOptions(), listRequests(), listClientContacts()])
    : [[], { ok: true as const, rows: [] }, []];

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={LIST} label="Back to Forms" />

      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href={LIST} className="no-underline" style={{ color: "inherit" }}>
          Forms
        </Link>
        {" / "}
        <span style={{ color: "var(--text-secondary)" }}>{form.title}</span>
      </div>

      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <form action={saveForm}>
        <FormDirtyProvider>
        <input type="hidden" name="form_id" value={formId} />

        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              {/* The title is the heading, and editing it in place is the whole
                  point of a builder, a separate rename dialog for the one
                  field you are looking at would be ceremony. */}
              <input
                name="title"
                defaultValue={form.title}
                aria-label="Form name"
                className="min-w-0 flex-1 rounded-control border border-transparent bg-transparent px-1 py-0.5 text-[24px] font-bold tracking-[-0.3px] hover:border-line focus:border-line-strong focus:outline-none"
              />
              <Pill tone={visibilityTone(form.visibility)}>
                {visibilityLabel(form.visibility)}
              </Pill>
            </div>
            {/* Not a field count. This read `form.fields.length`, which is what
                was last saved, directly above a panel counting what is on
                screen, so mid-edit the header said "0 fields" over "Fields
                (2)". The count belongs to the panel that owns the fields; the
                reference's header carries how far the form has got instead. */}
            <div className="mt-1 px-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {[
                form.duplicatedFrom ? `Duplicated from ${form.duplicatedFrom}` : null,
                `Used on ${form.timesUsed} request${form.timesUsed === 1 ? "" : "s"} so far`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>

          {/* 11.1b draws two. Send is the third, and it belongs here as well
              as on the list: this is where a form is finished, and finishing
              one and then going back to a list to send it is a journey the
              screen can spare somebody. The three are one component because
              the reason Send is grey has to be written under them. */}
          <BuilderActions
            sendHref={`${here}?send=1`}
            settingsHref={`${here}${here.includes("?") ? "&" : "?"}settings=1`}
            clientVisible={form.visibility === "client_visible"}
            hasFields={form.fields.length > 0}
            allowSend={showClients}
          />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <FieldList initial={form.fields} />
          </div>

          <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[280px]">
            {/* 11.1b puts Field Types first and Settings under it. */}
            <Panel title="Field Types">
              {FIELD_TYPES.map((type) => type.label).join(" · ")}
            </Panel>

            {/* And states Settings rather than offering them: "Visibility:
                Internal / Category: Confirmations / Used on 0 requests so far".
                Read like that it is three facts about the form, not three more
                controls competing with the fields beside them.

                Edit is ours. Left as pure text, a form's visibility could never
                change after the New Form dialog, and visibility is what decides
                whether it can be sent at all, while its category could never be
                set, because nothing else asks for one. */}
            <Panel title="Settings">
              {settingsOpen ? (
                <div className="flex flex-col gap-3">
                  <label className="block">
                    <span
                      className="mb-1.5 block text-[12px] font-medium"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Visibility
                    </span>
                    <select
                      name="visibility"
                      defaultValue={form.visibility}
                      className="w-full rounded-control border border-line-strong bg-surface px-2.5 py-[7px] text-[13px]"
                    >
                      {FORM_VISIBILITY.filter(
                        (option) => showClients || option.value !== "client_visible",
                      ).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span
                      className="mb-1.5 block text-[12px] font-medium"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      Category
                    </span>
                    <select
                      name="category"
                      defaultValue={form.category ?? ""}
                      className="w-full rounded-control border border-line-strong bg-surface px-2.5 py-[7px] text-[13px]"
                    >
                      <option value="">No category</option>
                      {FORM_CATEGORIES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <span className="text-[12px]" style={{ color: "var(--text-quiet)" }}>
                    Saved when you save the form.
                  </span>
                </div>
              ) : (
                <>
                  {/* Still submitted while the panel is closed, or saving would
                      quietly reset both to whatever the browser sends for a
                      control that is not there. */}
                  <input type="hidden" name="visibility" value={form.visibility} />
                  <input type="hidden" name="category" value={form.category ?? ""} />

                  <div className="leading-[1.9]">
                    Visibility: {visibilityLabel(form.visibility)}
                    <br />
                    Category: {form.category ?? "None"}
                    <br />
                    Used on {form.timesUsed} request{form.timesUsed === 1 ? "" : "s"} so far
                  </div>

                  <Link
                    href={`${here}${here.includes("?") ? "&" : "?"}settings=1`}
                    className="mt-2 inline-block text-[12.5px] no-underline"
                    style={{ color: "var(--accent)" }}
                  >
                    Edit
                  </Link>
                </>
              )}
            </Panel>
          </aside>
        </div>
        </FormDirtyProvider>
      </form>

      {created ? (
        <Toast
          title="Form created"
          detail="Add the questions you need, then save it."
          closeHref={here}
        />
      ) : null}

      {saved ? (
        <Toast title="Form saved" detail={`"${form.title}" is ready to send.`} closeHref={here} />
      ) : null}

      {sent ? (
        <Toast
          title="Form sent"
          detail="It's on the client's Forms screen now, under Action Required."
          closeHref={here}
        />
      ) : null}

      {previewing ? (
        <PreviewFormDialog name={form.title} fields={form.fields} closeHref={here} />
      ) : null}

      {sending && showClients ? (
        <SendFormDialog
          formId={form.id}
          formTitle={form.title}
          clients={clients.map((client) => ({ id: client.id, title: client.name }))}
          contacts={contacts}
          requests={
            requestsResult.ok
              ? requestsResult.rows.map((request) => ({
                  id: request.id,
                  title: request.title,
                  clientName: request.client_name,
                }))
              : []
          }
          closeHref={here}
          error={error}
        />
      ) : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-line p-4">
      <div className="mb-2.5 text-[13px] font-semibold">{title}</div>
      <div className="text-[12.5px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
        {children}
      </div>
    </div>
  );
}
