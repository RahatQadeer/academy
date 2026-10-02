import { Button } from "@/base/components/Button";
import { BUTTON_SIZE } from "@/client-portal/components/buttons";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { listForms } from "@/client-portal/lib/data/forms";
import { dueLabel, relativeTime } from "@/client-portal/lib/format";
import {
  FORM_STATUS,
  formActionLabel,
  formIsEditable,
} from "@/client-portal/lib/status";
import { param, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { Pill } from "@/base/components/Pill";
import { PageBody } from "@/client-portal/components/PageHeader";
import { ChipNav } from "@/client-portal/components/ChipNav";
import { DataNotice } from "@/client-portal/components/DataNotice";
import {
  ListPanel,
  PanelBody,
  PanelEmpty,
  PanelMeta,
  PanelRow,
  PanelRows,
  PanelSearch,
  PanelTags,
  PanelTitle,
} from "@/client-portal/components/Panel";
import { StatusPill } from "@/client-portal/components/StatusPill";
import type { FormStatus, PortalForm } from "@/client-portal/types";

const TABS = ["action-required", "in-progress", "submitted", "accepted"] as const;

const LABELS: Record<(typeof TABS)[number], string> = {
  "action-required": "Action Required",
  "in-progress": "In Progress",
  submitted: "With Your Team",
  accepted: "Accepted",
};

/**
 * The four tabs, over the six states.
 *
 * Grouped by whose move it is, which is the question a client opens this screen
 * to answer. Action Required holds the two states waiting on them — one never
 * started, one sent back for a correction. With Your Team holds the two that
 * are with the professional. Accepted is its own tab rather than the tail of
 * "Submitted" because "has my team signed this off?" is the thing the previous
 * three-bucket version could not answer at all.
 */
const STATUSES_FOR_TAB: Record<(typeof TABS)[number], FormStatus[]> = {
  "action-required": ["awaiting", "correction_required"],
  "in-progress": ["draft"],
  submitted: ["submitted", "needs_review"],
  accepted: ["accepted"],
};

const BASE = "/client-portal/forms";

/** A chip keeps the search and the category already chosen. */
function tabHrefFor(tab: (typeof TABS)[number], q: string, category: string) {
  const query = new URLSearchParams();
  if (tab !== "action-required") query.set("tab", tab);
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  const rest = query.toString();
  return rest ? `${BASE}?${rest}` : BASE;
}

/** The tile's colour: whose move it is, before a word of the row is read. */
/**
 * The date for a row, which is a different one in each state.
 *
 * Every row used to read "Submitted …" or nothing at all, so a form accepted
 * three weeks ago and one submitted this morning said the same thing. The date
 * shown is the one that matches the status beside it: the decision date once
 * there has been a decision, the submission date while it is with the team, and
 * the date it arrived while it is still the client's to answer.
 */
function whenFor(form: PortalForm): string | null {
  switch (form.status) {
    case "accepted":
      return form.reviewedAt ? `Accepted ${relativeTime(form.reviewedAt)}` : "Accepted";
    case "correction_required":
      return form.reviewedAt
        ? `Sent back ${relativeTime(form.reviewedAt)}`
        : "Correction requested";
    case "submitted":
    case "needs_review":
      return form.submittedAt ? `Submitted ${relativeTime(form.submittedAt)}` : null;
    default:
      return form.sentAt ? `Sent ${relativeTime(form.sentAt)}` : null;
  }
}

/** "3 / 20", or nothing where there is nothing to count. */
function progressOf(form: PortalForm): string | null {
  if (form.fields.length === 0) return null;
  if (form.status === "accepted") return null;

  const done = form.fields.filter((field) => {
    const answer = form.responses[field.key]?.trim();
    if (!answer) return false;
    // One sent back is waiting on a new answer, not an answer already given.
    return !form.correctionFields.includes(field.key);
  }).length;

  if (done === 0) return null;
  return `${done} / ${form.fields.length}`;
}

export default async function FormsScreen({ searchParams }: ScreenProps) {
  const tab = tabParam(searchParams, TABS, "action-required");
  const search = (param(searchParams, "q") ?? "").trim();
  const category = param(searchParams, "category") ?? "";

  const [context, forms] = await Promise.all([getPortalContext(), listForms()]);

  const inTab = forms.filter((form) => STATUSES_FOR_TAB[tab].includes(form.status));

  /*
   * Search and category, applied after the tab.
   *
   * Category used to group the list into sections rather than filter it, on the
   * grounds that eight forms read better as three headed groups than as eight
   * unrelated errands. That is true of eight and stops being true of forty,
   * where the headings are themselves a list to scroll. It is a column and a
   * filter now, the way Whitby files every list: the grouping is still there to
   * be had, by choosing one.
   */
  const visible = inTab.filter((form) => {
    if (category && (form.category ?? "Other") !== category) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      form.title.toLowerCase().includes(needle) ||
      (form.requestTitle?.toLowerCase().includes(needle) ?? false)
    );
  });

  const categories = [...new Set(forms.map((form) => form.category ?? "Other"))].sort();
  const filtered = Boolean(search || category);

  return (
    <PageBody>

      <DataNotice context={context} />

      <ListPanel
        controls={
          <>
            <PanelSearch
              action={BASE}
              placeholder="Search forms"
              value={search}
              hidden={{ tab: tab === "action-required" ? undefined : tab }}
              selects={[
                {
                  name: "category",
                  anyLabel: "All categories",
                  value: category,
                  options: categories.map((one) => ({ value: one, label: one })),
                },
              ]}
            />
            {/* Action Required counted in red, and the rest counted too: a
                client who has answered everything should be able to see that
                from the row rather than by opening four tabs to check. */}
            <ChipNav
              label="Form state"
              active={tab}
              chips={TABS.map((key) => ({
                key,
                label: LABELS[key],
                href: tabHrefFor(key, search, category),
                count: forms.filter((form) => STATUSES_FOR_TAB[key].includes(form.status))
                  .length,
                urgent: key === "action-required",
              }))}
            />
          </>
        }
      >
        {visible.length === 0 ? (
          <PanelEmpty
            glyph={filtered ? "⌕" : "▤"}
            title={
              filtered
                ? "Nothing matches that"
                : tab === "submitted"
                  ? "Nothing submitted yet"
                  : "No forms right now"
            }
            detail={
              filtered
                ? "No form here mentions that. Clear the filters to see the rest."
                : "When your team needs information from you, the form will appear here."
            }
            action={
              filtered
                ? { label: "Clear filters", href: tabHrefFor(tab, "", "") }
                : undefined
            }
          />
        ) : (
          <PanelRows>
            {visible.map((form) => {
              const note =
                form.status === "correction_required" && form.correctionNote
                  ? form.correctionNote
                  : null;
              const progress = progressOf(form);
              const due = form.dueLabel
                ? dueLabel(form.dueLabel, new Date(), context.timezone)
                : null;

              return (
                <PanelRow
                  key={form.id}
                  href={`${BASE}/${form.id}`}
                  when={whenFor(form) ?? undefined}
                  dim={form.status === "accepted"}
                  trailing={
                    <Button
                      href={`${BASE}/${form.id}`}
                      variant={formIsEditable(form.status) ? "primary" : "secondary"}
                      unsized
                      className={BUTTON_SIZE.row}
                    >
                      {formActionLabel(form.status)}
                    </Button>
                  }
                >
                  <PanelBody>
                    {/* When it moved, in the words that match the state it is
                        in — see `whenFor`. */}
                    <PanelTitle>{form.title}</PanelTitle>

                    {/* A correction carries the professional's own words for
                        what needs changing. A row that only said "Correction
                        requested" would leave the client opening the form to
                        find out why. */}
                    {note ? (
                      <span
                        className="block truncate text-[12.5px]"
                        style={{ color: "var(--danger-text)" }}
                        title={note}
                      >
                        {note}
                      </span>
                    ) : null}

                    <PanelMeta>
                      {[form.category ?? "Other", form.requestTitle].filter(Boolean).join(" · ")}
                    </PanelMeta>

                    <PanelTags>
                      <StatusPill status={FORM_STATUS[form.status]} />
                      {progress ? <Pill tone="neutral">{progress} answered</Pill> : null}
                      {due ? (
                        <Pill tone={due === "Overdue" ? "danger" : "neutral"}>{due}</Pill>
                      ) : null}
                    </PanelTags>
                  </PanelBody>
                </PanelRow>
              );
            })}
          </PanelRows>
        )}
      </ListPanel>

    </PageBody>
  );
}
