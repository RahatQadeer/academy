import { relativeTime } from "@/client-portal/lib/format";
import {
  PanelBody,
  PanelEmpty,
  PanelMeta,
  PanelRow,
  PanelRows,
} from "@/client-portal/components/Panel";
import type { ActivityEntry } from "@/client-portal/types";

/**
 * Client-safe activity only. This is not the internal Timeline — SRS 13.2.7
 * rules out a global client-facing timeline entirely. Every row here restates
 * something already on one of this reader's own screens; see `listActivity`.
 *
 * Drawn as the portal's list rows, with the mark that says what kind of thing
 * happened in the tile every other list leads with. A row is a link wherever
 * the thing it describes has a screen: the feed used to be inert, so a client
 * read "Invoice 1002 was issued" and then went to find Billing themselves.
 */
export function RecentActivity({
  entries,
  sources,
}: {
  entries: ActivityEntry[];
  /** How many of the seven areas this reader actually holds. */
  sources: number;
}) {
  if (entries.length === 0) {
    return (
      <PanelEmpty
        glyph="◷"
        title="No recent activity yet"
        detail={
          // An empty feed has two causes and a client cannot tell them apart.
          // Saying which one it is costs a clause.
          sources === 0
            ? "Your activity will appear here once your team shares an area of the portal with you."
            : "Documents, forms, invoices, replies and progress on your requests all appear here as they happen."
        }
      />
    );
  }

  return (
    <PanelRows>
      {entries.map((entry) => {
        return (
          <PanelRow
            key={entry.id}
            href={entry.href ?? undefined}
            when={relativeTime(entry.occurredAt)}
          >
            <PanelBody>
              {/* The body is a sentence, not a title, so it wraps rather than
                  truncating — this is the one list where the row's whole text
                  is the thing being read. */}
              <span className="block max-w-[72ch] text-[13.5px] leading-relaxed">
                {entry.body}
              </span>
              {entry.requestTitle ? <PanelMeta>{entry.requestTitle}</PanelMeta> : null}
            </PanelBody>
          </PanelRow>
        );
      })}
    </PanelRows>
  );
}
