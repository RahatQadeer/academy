import { Pill } from "@/base/components/Pill";
import { relativeTime } from "@/client-portal/lib/format";
import { CategoryTag } from "./CategoryTag";
import type { ProgressUpdate } from "@/client-portal/types";
import {
  PanelBody,
  PanelEmpty,
  PanelMeta,
  PanelRow,
  PanelRows,
  PanelTags,
  PanelTitle,
} from "./Panel";

const TYPE_LABEL: Record<ProgressUpdate["type"], string> = {
  progress_update: "Progress Update",
  plans_update: "Plans Update",
};

function shortBody(body: string, max = 44): string {
  if (body.length <= max) return body;
  return `${body.slice(0, max).trimEnd()}…`;
}

/**
 * The bold title line above the update body.
 *
 * `headline` (whitbyos/026) is the professional's own title and is used
 * whenever there is one — `postUpdate` will not save an update without it, so
 * that is every update posted since the migration. The synthesized "Progress
 * Update — Household Staffing Search" is kept only for rows written before the
 * column existed, which have no title of their own to show. Before this, every
 * update in the feed read as its own category label and the headline somebody
 * had written was never displayed anywhere.
 */
function titleFor(update: ProgressUpdate, isOwnPost: boolean, showRequest: boolean): string {
  if (isOwnPost) return `You shared: ${shortBody(update.body)}`;
  if (update.headline) return update.headline;
  const label = TYPE_LABEL[update.type];
  return showRequest && update.requestTitle ? `${label}, ${update.requestTitle}` : label;
}

/**
 * The feed, as rows in the portal's list panel.
 *
 * Only the rows: the panel around them belongs to the screen, because this is
 * drawn both on Updates — under its search and chips — and on a Request's own
 * Updates tab, where there is nothing to filter and the panel carries rows
 * alone.
 */
export function UpdateFeed({
  updates,
  emptyTitle = "No updates yet",
  emptyBody = "Progress updates from your team will appear here.",
  showRequest = true,
  viewerName,
  emptyAction,
}: {
  updates: ProgressUpdate[];
  emptyTitle?: string;
  emptyBody?: string;
  showRequest?: boolean;
  /** The signed-in client's display name — distinguishes their own posts. */
  viewerName?: string;
  emptyAction?: { label: string; href: string };
}) {
  if (updates.length === 0) {
    return <PanelEmpty glyph="◐" title={emptyTitle} detail={emptyBody} action={emptyAction} />;
  }

  return (
    <PanelRows>
      {updates.map((update) => {
        const isOwnPost = viewerName != null && update.authorName === viewerName;

        return (
          <PanelRow key={update.id} when={relativeTime(update.publishedAt)}>
            <PanelBody>
              <PanelTitle>
                {titleFor(update, isOwnPost, showRequest)}
              </PanelTitle>

              {/* An update is the one thing in the portal that is prose, so it
                  wraps and is measured at the paragraph. Everything else on a
                  row is one line that truncates. */}
              <PanelMeta clamp={false}>{update.body}</PanelMeta>

              {/* The category, and the Request when the feed spans several. A
                  headline now carries the title, so the Request it belongs to
                  is no longer folded into that line and has to be said here
                  instead. */}
              {update.urgent || update.category || (showRequest && update.requestTitle) ? (
                <PanelTags>
                  {update.urgent ? <Pill tone="danger">Urgent</Pill> : null}
                  {update.category ? <CategoryTag category={update.category} /> : null}
                  {showRequest && update.requestTitle && update.headline ? (
                    <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      {update.requestTitle}
                    </span>
                  ) : null}
                </PanelTags>
              ) : null}
            </PanelBody>
          </PanelRow>
        );
      })}
    </PanelRows>
  );
}
