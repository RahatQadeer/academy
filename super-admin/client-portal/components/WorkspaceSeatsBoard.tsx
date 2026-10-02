"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/base/components/Pill";
import { Button } from "@/base/components/Button";
import { Callout } from "@/base/components/Callout";
import { setWorkspaceSeatLimits } from "@/super-admin/client-portal/actions";
import { DEFAULT_MAX_ADDITIONAL_MEMBERS } from "@/base/lib/portal-seats";
import type { WorkspaceSeatRow } from "@/super-admin/client-portal/lib/load-workspaces";

/** The four cuts of the roster, as chips above the list. */
type Cut = "all" | "raised" | "baseline" | "empty";

const CUTS: { key: Cut; label: string }[] = [
  { key: "all", label: "All" },
  { key: "raised", label: "Above baseline" },
  { key: "baseline", label: "At baseline" },
  { key: "empty", label: "No clients" },
];

function cutOf(item: WorkspaceSeatRow): Exclude<Cut, "all"> {
  if (item.clientCount === 0) return "empty";
  return item.maxAdditionalMembers > DEFAULT_MAX_ADDITIONAL_MEMBERS
    ? "raised"
    : "baseline";
}

/**
 * Workspaces on the left, the one being edited on the right.
 *
 * This was a column of full-width cards, each carrying its own pair of inputs
 * and its own save button. Every workspace was therefore as tall as a form
 * whether or not anybody was changing it, and finding the one you came for
 * meant scrolling past all of them. The list is a list again — one scannable
 * row each, showing the two numbers it holds — and the form exists once, beside
 * it, for whichever row is selected.
 */
export function WorkspaceSeatsBoard({ items }: { items: WorkspaceSeatRow[] }) {
  const [query, setQuery] = useState("");
  const [cut, setCut] = useState<Cut>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null,
  );

  const counts = useMemo(() => {
    const tally = { all: items.length, raised: 0, baseline: 0, empty: 0 };
    for (const item of items) tally[cutOf(item)] += 1;
    return tally;
  }, [items]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (cut !== "all" && cutOf(item) !== cut) return false;
      if (!needle) return true;
      return (
        item.name.toLowerCase().includes(needle) ||
        item.slug.toLowerCase().includes(needle)
      );
    });
  }, [items, query, cut]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const accounts = items.reduce((sum, item) => sum + item.clientCount, 0);

  if (items.length === 0) {
    return (
      <Callout tone="info" title="No workspaces yet">
        Seat limits appear here once a professional has a workspace.
      </Callout>
    );
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Stat value={String(items.length)} label="Workspaces" />
        <Stat value={String(accounts)} label="Client accounts" />
        <Stat
          value={String(counts.raised)}
          label="Above the baseline"
          detail={`${DEFAULT_MAX_ADDITIONAL_MEMBERS} additional members`}
          tone={counts.raised > 0 ? "accent" : "ink"}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={query} onChange={setQuery} />
        <div className="flex flex-wrap items-center gap-1.5">
          {CUTS.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              count={counts[option.key]}
              active={cut === option.key}
              onSelect={() => setCut(option.key)}
            />
          ))}
        </div>
      </div>

      {/* Side by side from `lg`; stacked below it, where a 380px form beside a
          list would leave neither enough room. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div
            className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5"
            style={{ background: "var(--surface-soft)" }}
          >
            <span
              className="text-[11.5px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-faint)" }}
            >
              Workspace
            </span>
            <span
              className="text-[11.5px] font-semibold uppercase tracking-[0.05em]"
              style={{ color: "var(--text-faint)" }}
            >
              Members · Users
            </span>
          </div>

          {shown.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-[13.5px] font-medium">No workspace matches</div>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                Clear the search or pick a different filter.
              </p>
            </div>
          ) : (
            // Its own scroll, so the page itself stays one screen however many
            // workspaces there are.
            <div className="max-h-[560px] overflow-y-auto divide-y divide-line">
              {shown.map((item) => (
                <WorkspaceRow
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pinned while the list scrolls past it. */}
        <div className="lg:sticky lg:top-6">
          {selected ? (
            <SeatEditor key={selected.id} workspace={selected} />
          ) : (
            <div className="rounded-card border border-dashed border-line-strong p-6 text-center">
              <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                Pick a workspace to set its limits.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function WorkspaceRow({
  item,
  selected,
  onSelect,
}: {
  item: WorkspaceSeatRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const raised = item.maxAdditionalMembers > DEFAULT_MAX_ADDITIONAL_MEMBERS;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-soft)]"
      style={
        selected
          ? {
              background: "var(--accent-tint-soft)",
              boxShadow: "inset 3px 0 0 var(--accent)",
            }
          : undefined
      }
    >
      {/* The Client Portal's own module colour — this is a portal rule, and the
          swatch says so at a glance on a staff screen that also runs Partner
          Center. */}
      <span
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-swatch text-[11px] font-semibold"
        style={{ background: "var(--module-portal-bg)", color: "var(--module-portal-fg)" }}
      >
        {initials(item.name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{item.name}</span>
        <span
          className="block truncate text-[12px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {item.slug ? `/${item.slug} · ` : ""}
          {item.clientCount === 1 ? "1 client account" : `${item.clientCount} client accounts`}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <Pill tone={raised ? "accent" : "neutral"}>{item.maxAdditionalMembers}</Pill>
        <Pill tone="neutral">
          {item.maxAuthorizedUsers === null ? "∞" : item.maxAuthorizedUsers}
        </Pill>
      </span>
    </button>
  );
}

function SeatEditor({ workspace }: { workspace: WorkspaceSeatRow }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const storedAuthorized =
    workspace.maxAuthorizedUsers === null ? "" : String(workspace.maxAuthorizedUsers);
  const [additional, setAdditional] = useState(String(workspace.maxAdditionalMembers));
  const [authorized, setAuthorized] = useState(storedAuthorized);

  // Nothing to save until something differs from what is stored.
  const changed =
    additional !== String(workspace.maxAdditionalMembers) ||
    authorized !== storedAuthorized;

  async function submit() {
    setError(null);
    setMessage(null);
    setSaving(true);
    const result = await setWorkspaceSeatLimits({
      workspaceId: workspace.id,
      maxAdditionalMembers: additional,
      maxAuthorizedUsers: authorized,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage(result.message ?? "Saved.");
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div
        className="border-b border-line px-4 py-3"
        style={{ background: "var(--surface-soft)" }}
      >
        <div className="truncate text-[14.5px] font-semibold">{workspace.name}</div>
        <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {workspace.slug ? `/${workspace.slug} · ` : ""}
          {workspace.clientCount === 1
            ? "1 client account"
            : `${workspace.clientCount} client accounts`}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <SeatField
          label="Additional members"
          hint={`Per client account. Baseline is ${DEFAULT_MAX_ADDITIONAL_MEMBERS}.`}
          value={additional}
          onChange={setAdditional}
          disabled={saving}
          placeholder={String(DEFAULT_MAX_ADDITIONAL_MEMBERS)}
        />
        <SeatField
          label="Authorized users"
          hint="Leave blank for no limit."
          value={authorized}
          onChange={setAuthorized}
          disabled={saving}
          placeholder="No limit"
        />

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            unsized
            className="px-4 py-[9px] text-[13.5px]"
            onClick={submit}
            disabled={saving || !changed}
          >
            {saving ? "Saving…" : "Save limits"}
          </Button>
          {changed && !saving ? (
            <Button
              variant="ghost"
              unsized
              className="px-3 py-[9px] text-[13px]"
              onClick={() => {
                setAdditional(String(workspace.maxAdditionalMembers));
                setAuthorized(storedAuthorized);
                setError(null);
                setMessage(null);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>

        {/* --danger-text, not --danger-fg: the latter is tuned to sit on
            --danger-bg and reads muddy on this panel's white. */}
        {error ? (
          <p className="text-[12.5px] leading-[1.5]" style={{ color: "var(--danger-text)" }}>
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-[12.5px] leading-[1.5]" style={{ color: "var(--success-fg)" }}>
            {message}
          </p>
        ) : null}

        <p
          className="border-t border-line pt-3 text-[12px] leading-[1.55]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Applies to every client account in this workspace. The client sees the
          count against it on People &amp; Access; the professional sees it on
          the client&rsquo;s Account tab and cannot change it.
        </p>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  detail,
  tone = "ink",
}: {
  value: string;
  label: string;
  detail?: string;
  tone?: "ink" | "accent";
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <div
        className="text-[26px] font-bold leading-none tracking-[-0.6px]"
        style={{ color: tone === "accent" ? "var(--accent)" : "var(--ink)" }}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-soft)" }}>
        {label}
      </div>
      {detail ? (
        <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search workspaces"
      aria-label="Search workspaces by name or URL"
      className="h-[34px] w-full max-w-[260px] rounded-control border border-line-strong bg-surface px-3 text-[13.5px]"
    />
  );
}

function FilterChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  // The portal's chip select: accent border and tint when chosen, a hairline
  // and secondary text when not.
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="inline-flex h-[34px] items-center gap-1.5 rounded-control border px-3 text-[13px] font-medium transition-colors"
      style={
        active
          ? {
              borderColor: "var(--accent)",
              background: "var(--accent-tint-mid)",
              color: "var(--accent-hover)",
            }
          : {
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--text-muted)",
            }
      }
    >
      {label}
      <span className="text-[11.5px] tabular-nums" style={{ opacity: 0.7 }}>
        {count}
      </span>
    </button>
  );
}

function SeatField({
  label,
  hint,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </span>
      <input
        type="number"
        min={0}
        max={999}
        step={1}
        inputMode="numeric"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-control border border-line-strong bg-surface px-3 py-[9px] text-[14px] text-ink disabled:opacity-50"
      />
      <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
        {hint}
      </span>
    </label>
  );
}

/** Two letters for the row swatch — "Hartwell Family Office" → "HF". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
