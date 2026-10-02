import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Modal } from "@/whitbyos/components/Modal";
import { CONTROL, Field } from "@/whitbyos/components/Field";
import { generateReport } from "@/whitbyos/reports/actions";
import { REPORT_TYPES } from "@/whitbyos/lib/reports";

/** Screen 15.1 — Generate Report. */
export function GenerateReportDialog({
  clients,
  closeHref,
  error,
}: {
  clients: { id: string; name: string }[];
  closeHref: string;
  error?: string;
}) {
  return (
    <Modal title="Generate Report" closeHref={closeHref} width={480} dense>
      <form action={generateReport} className="flex flex-col gap-4">
        {error ? <Callout tone="danger">{error}</Callout> : null}

        <Field label="Report type" htmlFor="type">
          <select
            id="type"
            name="type"
            defaultValue={clients.length > 0 ? "client_summary" : "activity"}
            className={`${CONTROL} text-[13.5px]`}
          >
            {REPORT_TYPES.filter((option) => clients.length > 0 || option.value !== "client_summary").map(
              (option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ),
            )}
          </select>
        </Field>

        {clients.length > 0 ? (
        <Field label="Client" htmlFor="client_id">
          <select id="client_id" name="client_id" defaultValue="" className={`${CONTROL} text-[13.5px]`}>
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        ) : null}

        {/* 15.1 labels the pair once and lets the two inputs say which end they
            are, which is also what stops "From" and "To" being read as two
            separate questions. */}
        {/* A date input ignores its placeholder in most browsers, so "Start"
            and "End" were words nobody ever saw. They are labels. */}
        <Field label="Date range" htmlFor="period_start">
          <div className="flex gap-3">
            <span className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="period_start"
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                Start date
              </label>
              <input id="period_start" name="period_start" type="date" className={CONTROL} />
            </span>
            <span className="flex flex-1 flex-col gap-1">
              <label
                htmlFor="period_end"
                className="text-[12px]"
                style={{ color: "var(--text-tertiary)" }}
              >
                End date
              </label>
              <input id="period_end" name="period_end" type="date" className={CONTROL} />
            </span>
          </div>
        </Field>

        {clients.length > 0 ? (
        <label className="flex items-start gap-2.5 text-[13.5px]">
          <input
            type="checkbox"
            name="share"
            className="mt-0.5 h-[15px] w-[15px] shrink-0"
            style={{ accentColor: "var(--accent)" }}
          />
          <span>Share with client automatically</span>
        </label>
        ) : null}

        <div className="mt-1 flex justify-end gap-2.5">
          <Button unsized href={closeHref} variant="secondary" className="px-4 py-[9px] text-[13.5px]">
            Cancel
          </Button>
          <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
            Generate
          </Submit>
        </div>
      </form>
    </Modal>
  );
}
