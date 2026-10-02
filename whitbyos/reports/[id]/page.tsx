import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/whitbyos/components/BackLink";
import { DownloadReport } from "@/whitbyos/reports/[id]/components/DownloadReport";
import { Toast } from "@/whitbyos/components/Toast";
import { getReport, typeLabel } from "@/whitbyos/lib/reports";
import { shortDate } from "@/whitbyos/lib/format";
import {
  REPORT_VIEWS,
  ReportCharts,
  ReportKanban,
  ReportTimeline,
  ReportViewTabs,
  type ReportView,
} from "@/whitbyos/reports/[id]/components/ReportViews";

const LIST = "/whitbyos/reports";

/**
 * Screen 15.3 — one report.
 *
 * Everything shown is read off the row rather than recomputed. The whole point
 * of a report is that it says what was true on the day it was made, and a
 * client may already have read it.
 */
export default async function ReportDetailPage({
  reportId,
  searchParams,
}: {
  reportId: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const report = await getReport(reportId);
  if (!report) notFound();

  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const here = `${LIST}/${reportId}`;
  const generated = one(searchParams?.generated) === "1";
  const view = (REPORT_VIEWS.some((tab) => tab.slug === one(searchParams?.view))
    ? one(searchParams?.view)
    : "") as ReportView;

  const streams = report.contents.streams ?? [];
  const requests = report.contents.requests;

  return (
    <div className="px-5 py-6 sm:px-8 sm:py-9 xl:px-12">
      <BackLink href={LIST} label="Back to Reports" />

      <div className="mb-2.5 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
        <Link href={LIST} className="no-underline" style={{ color: "inherit" }}>
          Reports
        </Link>
        {" / "}
        <span style={{ color: "var(--text-secondary)" }}>{report.title}</span>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[24px] font-bold tracking-[-0.3px]">{report.title}</h1>
          <div className="mt-1 flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            <span>
              {[
                typeLabel(report.type),
                report.generatedAt ? `Generated ${shortDate(report.generatedAt)}` : "Not generated yet",
                report.periodStart && report.periodEnd
                  ? `${shortDate(report.periodStart)} – ${shortDate(report.periodEnd)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>

        {/*
          * Share with Client, and the "Shared" badge beside the title, are
          * not here.
          *
          * Both moved a flag — `shared_with_client` — that nothing reads:
          * the portal does not query `whitbyos_reports` at all, so a shared
          * report reached no client and "Stop sharing" took it out of
          * nowhere. A button that reports work it did not do is worse than
          * an absent one, because the absent one does not have to be found
          * out.
          *
          * `shareReport` is left in actions.ts. The flag it writes is the
          * right flag; what is missing is a Reports screen in the portal to
          * read it, and this comes back when that exists.
          */}
        <div className="flex shrink-0 items-center gap-2">
          <DownloadReport />
        </div>
      </div>

      {!report.generatedAt ? (
        <div
          className="rounded-[8px] border px-4 py-3.5 text-[13px]"
          style={{ background: "var(--warning-bg)", borderColor: "var(--warning-border)", color: "var(--warning-fg)" }}
        >
          This report is scheduled for {shortDate(report.scheduledFor)} and has
          not been produced yet. Nothing runs on a timer, so it will need
          generating on the day.
        </div>
      ) : (
        <>
          {/*
            * The summary reads first.
            *
            * It sat under the charts, which meant the sentence saying what
            * the period amounted to came after four graphs of the period —
            * and on a long report, after a scroll. Somebody opening a report
            * wants to know what it says before they are shown the working,
            * and a client sent one reads the top of it and stops.
            */}
          {report.contents.summary ? (
            <p
              className="mb-5 max-w-[78ch] text-[14px] leading-[1.75]"
              style={{ color: "var(--text-secondary)" }}
            >
              {report.contents.summary}
            </p>
          ) : null}

          <ReportViewTabs here={here} view={view} />

          {view === "kanban" ? (
            streams.length === 0 ? (
              <Empty />
            ) : (
              <ReportKanban
                streams={streams}
                from={report.periodStart}
                to={report.periodEnd}
              />
            )
          ) : view === "timeline" ? (
            streams.length === 0 ? (
              <Empty />
            ) : (
              <ReportTimeline
                streams={streams}
                from={report.periodStart}
                to={report.periodEnd}
                open={one(searchParams?.open) ?? null}
                zoom={one(searchParams?.zoom) ?? null}
                deps={one(searchParams?.deps) ?? null}
                bareOpen={one(searchParams?.bare) === "1"}
                here={here}
              />
            )
          ) : (
            <ReportCharts
              metrics={report.contents.metrics}
              weeks={report.contents.weeks}
              requests={requests}
              streams={streams}
            />
          )}
        </>
      )}

      {generated ? (
        <Toast
          title="Report generated"
          detail="What it says is fixed as of now. It will not change as the work moves on."
          closeHref={here}
        />
      ) : null}

    </div>
  );
}

/** Same sentence for all three views: the period simply held nothing. */
function Empty() {
  return (
    <div
      className="rounded-[8px] border border-line px-4 py-8 text-center text-[13px]"
      style={{ color: "var(--text-tertiary)" }}
    >
      Nothing was running in this period.
    </div>
  );
}
