import Link from "next/link";
import { Modal } from "@/whitbyos/components/Modal";
import { ExportSubmit } from "@/whitbyos/work-plans/[id]/components/ExportSubmit";
import { EXPORT_DEFAULTS, EXPORT_LAYOUTS } from "@/whitbyos/lib/plan-export";

/**
 * WP.22 — Export Work Plan as PDF.
 *
 * A plain GET form, submitting back to the plan it was opened from. Nothing
 * here needs to be saved: the answers are the query string on the link the
 * toast then offers, which is also why an export can be handed to somebody
 * else as a URL and come out the same.
 *
 * The dialog draws Cancel and no ✕, the way the reference draws it.
 */
export function ExportDialog({
  planId,
  planName,
  basePath,
  letterhead,
}: {
  planId: string;
  planName: string;
  basePath: string;
  /** The workspace's own name — what "letterhead" means on this account. */
  letterhead: string;
}) {
  return (
    <Modal
      title="Export Work Plan as PDF"
      closeHref={basePath}
      width={520}
      titleSize={17}
      headerGap={4}
      pad="px-7 pb-[22px] pt-[26px]"
      noClose
      scrim="rgba(15,15,15,.35)"
    >
      {/* `method="get"` to the plan is the fallback for a browser with no
          scripting: it lands back on the plan, which is where this always
          landed. With scripting, ExportSubmit sends the same fields to the
          route that renders the file and the browser downloads it. */}
      <form method="get" action={basePath}>
        <input type="hidden" name="exported" value="1" />
        <input type="hidden" name="set" value="1" />

        <div className="mb-5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
          {planName}, Work Plan
        </div>

        <div className="flex flex-col gap-3.5">
          <Group label="Layout">
            <div
              className="flex w-max gap-1 rounded-[8px] border p-[3px]"
              style={{ borderColor: "var(--border-strong)" }}
            >
              {EXPORT_LAYOUTS.map((row) => (
                <label key={row.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="layout"
                    value={row.value}
                    defaultChecked={row.value === EXPORT_DEFAULTS.layout}
                    className="peer sr-only"
                  />
                  <span
                    className="block rounded-[6px] px-3.5 py-1.5 text-[12.5px] font-medium text-[color:var(--text-secondary)] transition-colors peer-checked:bg-[color:var(--ink)] peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--accent)]"
                  >
                    {row.label}
                  </span>
                </label>
              ))}
            </div>
          </Group>

          <Group label="Include" gap={8}>
            <div className="flex flex-col gap-2">
              <Check name="streams" label="All Work Streams and tasks" on={EXPORT_DEFAULTS.streams} />
              <Check name="meta" label="Owners, due dates and status" on={EXPORT_DEFAULTS.meta} />
              <Check
                name="notes"
                label="Steps, contacts and what each task needs"
                on={EXPORT_DEFAULTS.notes}
              />
              <Check name="activity" label="Whitby activity log" on={EXPORT_DEFAULTS.activity} />
            </div>
          </Group>

          <Group label="Branding">
            {/* One real choice rather than a list of imagined ones: this
                workspace's name at the head of the page, or nothing. */}
            <select
              name="letterhead"
              defaultValue={EXPORT_DEFAULTS.letterhead ? "1" : ""}
              className="w-full appearance-none rounded-[6px] border bg-surface px-3 py-[9px] text-[13.5px] text-ink"
              style={{
                borderColor: "var(--border-strong)",
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='6'><path d='M0 0h9L4.5 6z' fill='rgba(55,53,47,.5)'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
              }}
            >
              <option value="1">{letterhead} letterhead</option>
              <option value="">No letterhead</option>
            </select>
          </Group>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Link
            href={basePath}
            className="rounded-[6px] border bg-surface px-4 py-[9px] text-[13.5px] font-medium no-underline"
            style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }}
          >
            Cancel
          </Link>
          <ExportSubmit planId={planId} closeHref={basePath} />
        </div>
      </form>
    </Modal>
  );
}

function Group({
  label,
  gap = 6,
  children,
}: {
  label: string;
  gap?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="text-[12px] font-semibold"
        style={{ color: "var(--text-secondary)", marginBottom: gap }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/**
 * The reference's tick: a filled accent square when on, an empty outline when
 * off. Drawn from the real checkbox next to it, so the keyboard reaches it and
 * the form still submits without any script.
 */
function Check({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-[9px] text-[13.5px]">
      <input type="checkbox" name={name} value="1" defaultChecked={on} className="peer sr-only" />
      {/* Both border colours are classes. An inline style would win over the
          checked one and the tick would sit in a grey box forever. */}
      <span
        className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border border-[color:var(--border-strong)] text-[10px] text-transparent transition-colors peer-checked:border-[color:var(--accent)] peer-checked:bg-[color:var(--accent)] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--accent)] peer-focus-visible:ring-offset-1"
        aria-hidden
      >
        ✓
      </span>
      {label}
    </label>
  );
}
