import { Button } from "@/base/components/Button";
import { Modal } from "@/whitbyos/components/Modal";
import { ExportButton } from "@/whitbyos/clients/[id]/components/ExportButton";

const RANGES = [
  { value: "all", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "year", label: "This year" },
];

const INCLUDE = [
  { name: "work", label: "Requests & Work Plans", on: true },
  { name: "documents", label: "Documents", on: true },
  { name: "whitby", label: "Whitby activity", on: true },
  { name: "messages", label: "Messages & Updates", on: false },
];

/**
 * Screen 2.1.6 — Export Timeline as PDF.
 *
 * A GET form rather than a server action: the export is a document to read,
 * not a change to make, so the choices belong in the URL and the result is a
 * page that can be reloaded, bookmarked or sent to a printer again.
 *
 * The export's own "Custom range…" option is left out until there is somewhere
 * to enter the two dates — an option that opens nothing is worse than four
 * that work.
 */
export function ExportTimelineDialog({
  clientId,
  clientName,
  closeHref,
}: {
  clientId: string;
  clientName: string;
  closeHref: string;
}) {
  return (
    <Modal title="Export Timeline as PDF" closeHref={closeHref} width={460} dense>
      {/* No target: the route answers with a PDF as an attachment, so the
          browser saves it and this screen stays where it was. Opening a tab
          for a download leaves an empty one behind. */}
      <form action={`/api/whitbyos/clients/${clientId}/timeline`}>
        <p className="mb-[18px] text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
          Downloads a PDF of {clientName}&apos;s activity timeline, made for
          sharing or for the file.
        </p>

        <div className="mb-4">
          <label
            htmlFor="range"
            className="mb-1.5 block text-[12px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Date range
          </label>
          <select
            id="range"
            name="range"
            defaultValue="all"
            className="w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-[13.5px]"
          >
            {RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <span
            className="mb-2 block text-[12px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Include
          </span>
          <div className="flex flex-col gap-0.5">
            {INCLUDE.map((item) => (
              <label
                key={item.name}
                className="flex items-center gap-2.5 px-1 py-1.5 text-[13.5px]"
              >
                <input
                  type="checkbox"
                  name={item.name}
                  value="1"
                  defaultChecked={item.on}
                  className="h-[15px] w-[15px]"
                  style={{ accentColor: "var(--accent)" }}
                />
                {item.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <ExportButton doneHref={closeHref} />
        </div>
      </form>
    </Modal>
  );
}
