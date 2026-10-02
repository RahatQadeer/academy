import { resolveDocumentUrl } from "@/base/lib/documents";
import { createClient } from "@/base/lib/supabase/server";
import { isSignablePdf } from "@/base/lib/signing/placement";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import {
  filterDocuments,
  groupByLabel,
  listDocuments,
} from "@/client-portal/lib/data/documents";
import { flag, param, tabParam, type ScreenProps } from "@/client-portal/lib/routing";
import { PageBody, PageIntro } from "@/client-portal/components/PageHeader";
import { ChipNav } from "@/client-portal/components/ChipNav";
import { DataNotice } from "@/client-portal/components/DataNotice";
import {
  ListPanel,
  PanelAction,
  PanelBody,
  PanelEmpty,
  PanelMeta,
  PanelRow,
  PanelRows,
  PanelSearch,
  PanelTitle,
} from "@/client-portal/components/Panel";
import { DocumentList } from "./components/DocumentList";
import { UploadModal } from "./components/UploadModal";
import { SignWorkspace } from "@/base/components/signing/SignWorkspace";
import {
  declineDocument,
  signWithTypedSignature,
  uploadSignedCopy,
} from "@/client-portal/lib/actions/documents";

const TABS = ["all", "action-needed", "labels", "archived"] as const;

const LABELS: Record<(typeof TABS)[number], string> = {
  all: "All",
  "action-needed": "Action Needed",
  labels: "Labels",
  archived: "Archived",
};

const BASE = "/client-portal/documents";

/** A chip keeps the search and the label already chosen. */
function tabHrefFor(tab: (typeof TABS)[number], q: string, label: string) {
  const query = new URLSearchParams();
  if (tab !== "all") query.set("tab", tab);
  if (q) query.set("q", q);
  if (label) query.set("label", label);
  const rest = query.toString();
  return rest ? `${BASE}?${rest}` : BASE;
}

export default async function DocumentsScreen({ searchParams }: ScreenProps) {
  const tab = tabParam(searchParams, TABS, "all");
  const search = (param(searchParams, "q") ?? "").trim();
  const label = param(searchParams, "label") ?? "";

  const [context, all] = await Promise.all([getPortalContext(), listDocuments()]);

  /*
   * Search and label, applied after the tab.
   *
   * A year of a client's paperwork is the one list here that grows without
   * anybody deciding it should, and it was the list with no way to look through
   * it: the Labels tab could say a label had eleven documents under it and then
   * offered no way to see those eleven.
   */
  const inTab = filterDocuments(all, tab);
  const visible = inTab.filter((doc) => {
    if (label && !doc.labels.includes(label)) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      doc.title.toLowerCase().includes(needle) ||
      (doc.requestTitle?.toLowerCase().includes(needle) ?? false) ||
      doc.labels.some((one) => one.toLowerCase().includes(needle))
    );
  });

  const labels = [...new Set(all.flatMap((doc) => doc.labels))].sort();
  const filtered = Boolean(search || label);

  const signingId = param(searchParams, "sign");
  const signing = signingId
    ? all.find((row) => row.id === signingId && row.actionType === "sign")
    : undefined;

  const signingFiles = signing && !context.viewOnly ? await signingUrls(signing.fileUrl) : null;

  return (
    <PageBody>
      <PageIntro note="Everything shared with you, and anything you upload. Internal files always stay with your team." />
      <DataNotice context={context} />

      <ListPanel
        controls={
          <>
            <PanelSearch
              action={BASE}
              placeholder="Search documents, requests and labels"
              value={search}
              hidden={{ tab: tab === "all" ? undefined : tab }}
              selects={
                labels.length > 0
                  ? [
                      {
                        name: "label",
                        anyLabel: "All labels",
                        value: label,
                        options: labels.map((one) => ({ value: one, label: one })),
                      },
                    ]
                  : []
              }
              trailing={
                // A view-only member is offered nothing to press: their grant
                // is sight of this area, and the action behind the button
                // would refuse them.
                context.viewOnly ? null : (
                  <PanelAction href={`${BASE}?tab=${tab}&upload=1`}>Upload</PanelAction>
                )
              }
            />
            {/* Action Needed counted in red. The other three carry their
                numbers too, so a client can see there is nothing archived
                without opening Archived to find out. */}
            <ChipNav
              label="Document filter"
              active={tab}
              chips={TABS.map((key) => ({
                key,
                label: LABELS[key],
                href: tabHrefFor(key, search, label),
                count:
                  key === "labels"
                    ? [...new Set(all.flatMap((doc) => doc.labels))].length
                    : filterDocuments(all, key).length,
                urgent: key === "action-needed",
              }))}
            />
          </>
        }
      >
        {visible.length === 0 ? (
          <PanelEmpty
            glyph={filtered ? "⌕" : "▥"}
            title={
              filtered
                ? "Nothing matches that"
                : tab === "archived"
                  ? "Nothing archived"
                  : "No documents yet"
            }
            detail={
              filtered
                ? "No document here mentions that. Clear the filters to see the rest."
                : tab === "archived"
                  ? "Documents your team archives are kept here."
                  : "Files your team shares with you, and files you upload, will collect here."
            }
            action={
              filtered ? { label: "Clear filters", href: tabHrefFor(tab, "", "") } : undefined
            }
          />
        ) : tab === "labels" ? (
          /* A label row opens the label. It used to be a dead row stating a
             count — the one place in the portal that named a group of
             documents and then gave no way to see them. */
          <PanelRows>
            {groupByLabel(visible).map(([name, group]) => (
              <PanelRow
                key={name}
                href={`${BASE}?label=${encodeURIComponent(name)}`}
              >
                <PanelBody>
                  <PanelTitle>{name}</PanelTitle>
                  <PanelMeta>
                    {group.length} {group.length === 1 ? "document" : "documents"}
                  </PanelMeta>
                </PanelBody>
              </PanelRow>
            ))}
          </PanelRows>
        ) : (
          <DocumentList
            documents={visible}
            showLabelForm={tab === "all" && !context.viewOnly}
            // `null`, not `undefined`: the prop has a default, so undefined
            // would quietly restore the very button this is turning off.
            uploadHref={context.viewOnly ? null : `${BASE}?tab=${tab}&upload=1`}
            signHref={
              context.viewOnly ? null : (documentId) => `${BASE}?tab=${tab}&sign=${documentId}`
            }
            timeZone={context.timezone}
          />
        )}
      </ListPanel>

      {flag(searchParams, "upload") && !context.viewOnly ? (
        <UploadModal closeHref={tabHrefFor(tab, search, label)} />
      ) : null}

      {/* Found in the list this client can already see, and only while it is
          actually being asked of them. An id in the address bar is not an
          invitation, and the action checks the same thing again on the way in. */}
      {signing && signingFiles ? (
        <SignWorkspace
          documentId={signing.id}
          title={signing.title}
          pdfUrl={signingFiles.view}
          downloadUrl={signingFiles.download}
          defaultName={context.mode === "live" ? context.displayName : ""}
          closeHref={tabHrefFor(tab, search, label)}
          eyebrow="Your team has asked you to sign"
          recipient="your team"
          signAction={signWithTypedSignature}
          uploadAction={uploadSignedCopy}
          declineAction={declineDocument}
        />
      ) : null}
    </PageBody>
  );
}

/**
 * The two links the signing screen needs, minted while it is open.
 *
 * `view` is what pdf.js reads to draw the pages — only for a PDF in Storage,
 * which is the only thing that can be signed on screen. `download` is the
 * paper route's copy, and works for any file. Both are short-lived: the page is
 * reloaded after signing, and a link that outlived it would be a way into the
 * bucket nobody meant to leave open.
 */
async function signingUrls(fileUrl: string | null | undefined) {
  const path = (fileUrl ?? "").trim();
  if (!path) return { view: null, download: null };

  const supabase = await createClient();
  const [view, download] = await Promise.all([
    isSignablePdf(path)
      ? supabase.storage
          .from("documents")
          .createSignedUrl(path, 60 * 30)
          .then(({ data }) => data?.signedUrl ?? null)
      : Promise.resolve(null),
    // A professional's document can still be a link to wherever it lives; the
    // rest are Storage objects, given long enough to be pressed at leisure.
    /^https?:\/\//i.test(path)
      ? resolveDocumentUrl(supabase, path, true)
      : supabase.storage
          .from("documents")
          .createSignedUrl(path, 60 * 30, { download: true })
          .then(({ data }) => data?.signedUrl ?? null),
  ]);

  return { view, download };
}
