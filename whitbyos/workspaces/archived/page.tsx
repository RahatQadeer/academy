import { SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { BackLink } from "@/whitbyos/components/BackLink";
import { StateMessage } from "@/whitbyos/components/StateMessage";
import { unarchiveClient } from "@/whitbyos/clients/actions";
import { getWorkspaceOverview } from "@/whitbyos/lib/workspace-overview";
import { kindLabel, shortDate } from "@/whitbyos/lib/format";
import { param, type SearchParams } from "@/whitbyos/lib/params";

const OVERVIEW = "/whitbyos/workspaces";

/**
 * Screen 0.9c — Archived Workspaces.
 *
 * The counting rule is the whole point of the screen, so it is stated at the
 * top rather than discovered by pressing Unarchive and being refused. It is
 * also enforced in the action, because a rule drawn on a page is not a rule.
 */
export default async function ArchivedWorkspacesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const error = param(searchParams, "error");
  const overview = await getWorkspaceOverview();
  const archived = overview?.archived ?? [];

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={OVERVIEW} />

      <h1 className="mb-2 text-[24px] font-bold tracking-[-0.3px]">
        Archived Workspaces
      </h1>

      <p className="mb-6 max-w-[640px] text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
        Archived workspaces don&apos;t count against your plan&apos;s
        active-workspace limit. Unarchiving one counts it again, you&apos;ll need
        to be under your limit first.
      </p>

      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      {archived.length === 0 ? (
        <StateMessage
          glyph="◔"
          title="Nothing archived"
          description="Archiving a workspace files it away and frees a slot on your plan. Everything in it stays intact."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line">
          {archived.map((card) => (
            <div
              key={card.id}
              className="flex items-center justify-between gap-4 border-b border-line px-4 py-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{card.name}</span>
                <span className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                  {[
                    card.type ? kindLabel(card.type) : null,
                    card.primaryContact,
                    card.archivedAt ? `Archived ${shortDate(card.archivedAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>

              <form action={unarchiveClient}>
                <input type="hidden" name="client_id" value={card.id} />
                <SubmitPlain
                 
                  className="shrink-0 rounded-control border border-line-strong px-4 py-[7px] text-[13px] font-medium"
                  style={{ background: "var(--surface)", color: "var(--ink)" }}
                >
                  Unarchive
                </SubmitPlain>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
