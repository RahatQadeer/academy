import Link from "next/link";
import { notFound } from "next/navigation";
import { Callout } from "@/base/components/Callout";
import { WizardChrome } from "@/whitbyos/components/WizardChrome";
import { PlaybookConfigure } from "@/whitbyos/work-plans/new/playbook/PlaybookConfigure";
import { getClient } from "@/whitbyos/lib/client-detail";
import {
  getPlaybook,
  listPlaybooks,
  type PlaybookRow,
} from "@/whitbyos/lib/playbooks";
import { listRequestOptions } from "@/whitbyos/lib/tasks";
import { relativeTime } from "@/whitbyos/lib/format";
import { SearchField } from "@/whitbyos/components/SearchField";
import { LiveSearch } from "@/whitbyos/components/LiveSearch";

const LIST = "/whitbyos/work-plans";

const STEPS = [
  "Choose how to build",
  "Configure",
  "Generate",
  "Review & Edit",
  "Save",
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * WP.8 and WP.9 — Select Playbook, then Configure.
 *
 * Two steps, as the reference has them, on one route: without a Playbook
 * chosen this is the picker, with one it is the configuration for it. The
 * wizard's own step marker moves with it, so "Back" from the second lands on
 * the first rather than out of the flow entirely.
 */
export default async function PlaybookPlanPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  /* No client is an answer — 099. A Playbook is a way of working, and the
     firm's own work is work. */
  const clientId = one(searchParams?.client) ?? "";

  const chosenId = one(searchParams?.playbook) ?? "";
  const query = (one(searchParams?.q) ?? "").trim().toLowerCase();
  const error = one(searchParams?.error);

  const [client, playbooks, requests] = await Promise.all([
    clientId ? getClient(clientId) : null,
    listPlaybooks(),
    listRequestOptions(),
  ]);
  if (clientId && !client) notFound();

  const rows: PlaybookRow[] = playbooks.ok ? playbooks.rows : [];
  const chosen = rows.find((row) => row.id === chosenId) ?? null;

  const named = one(searchParams?.name) ?? "";
  const here = `${LIST}/new/playbook?client=${clientId}${named ? `&name=${encodeURIComponent(named)}` : ""}`;

  // ---- WP.9, once a Playbook has been picked
  if (chosen) {
    // WP.9 names what carries over, so the tasks inside the Playbook's Work
    // Streams are counted rather than described.
    const detail = await getPlaybook(chosen.id);
    const taskCount = (detail?.streams ?? []).reduce(
      (sum, stream) => sum + stream.tasks.length,
      0,
    );

    return (
      <WizardChrome steps={STEPS} current={2} backHref={here} backLabel="Back">
        <PlaybookConfigure
          clientId={clientId}
          playbook={{
            id: chosen.id,
            name: chosen.name,
            streamCount: chosen.streamCount,
            taskCount,
          }}
          /* Only this client's Requests, so the plan cannot be hung off
             another client's work — and with None, only the ones that
             belong to nobody either. */
          requests={requests.filter((row) => (row.clientId ?? "") === clientId)}
          name={named}
          error={error}
        />
      </WizardChrome>
    );
  }

  // ---- WP.8, the picker
  const shown = query
    ? rows.filter((row) =>
        [row.name, row.category]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(query)),
      )
    : rows;

  return (
    <WizardChrome
      steps={STEPS}
      current={1}
      backHref={`${LIST}/new`}
      backLabel="Back"
    >
      <div className="flex flex-1 items-center justify-center px-5 py-6 sm:px-8 sm:py-10 xl:px-10">
        <div className="flex w-full max-w-[760px] flex-col gap-[18px]">
          <div>
            <h1 className="mb-1 text-[21px] font-bold">Select a Playbook</h1>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              Its Work Streams, providers and templates will carry into the new
              Work Plan.
            </p>
          </div>

          {error ? <Callout tone="danger">{error}</Callout> : null}

          {rows.length === 0 ? (
            <Callout tone="warning">
              This workspace has no Playbooks yet. Build one from{" "}
              <Link href="/whitbyos/playbooks/new">Playbooks</Link>, or go
              back and choose another way to start.
            </Callout>
          ) : (
            <>
              {/* A GET form, so the search survives a refresh and needs no
                  client component of its own. */}
              <form method="get" action={`${LIST}/new/playbook`}>
                <input type="hidden" name="client" value={clientId} />
                <SearchField
                  defaultValue={query}
                  placeholder="Search Playbooks…"
                  label="Search Playbooks"
                />
                {/* Narrows as you type — see `LiveSearch`. */}
                <LiveSearch />
              </form>

              {shown.length === 0 ? (
                <p
                  className="text-[13px]"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  No Playbook matches &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((playbook) => (
                    <Link
                      key={playbook.id}
                      href={`${here}&playbook=${playbook.id}`}
                      className="rounded-[8px] border border-line p-4 no-underline transition-colors hover:bg-[var(--surface-soft)]"
                      style={{ color: "var(--ink)" }}
                    >
                      <div className="mb-1 text-[14px] font-semibold">
                        {playbook.name}
                      </div>

                      <div
                        className="mb-2.5 text-[12px]"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {[
                          playbook.category,
                          `${playbook.streamCount} Work Stream${playbook.streamCount === 1 ? "" : "s"}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>

                      <div
                        className="mb-2.5 h-px"
                        style={{ background: "var(--border)" }}
                      />

                      <div
                        className="text-[11.5px]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Used on {playbook.timesUsed} Request
                        {playbook.timesUsed === 1 ? "" : "s"} · updated{" "}
                        {relativeTime(playbook.updatedAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </WizardChrome>
  );
}
