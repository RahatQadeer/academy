import { Pill } from "@/base/components/Pill";
import { relativeTime } from "@/client-portal/lib/format";
import { REQUEST_STATUS } from "@/client-portal/lib/status";
import { healthView, urgencyView } from "@/client-portal/lib/vocab";
import type { PortalRequest } from "@/client-portal/types";
import { StatusPill } from "./StatusPill";
import {
  PanelBody,
  PanelEmpty,
  PanelMeta,
  PanelRow,
  PanelRows,
  PanelTags,
  PanelTitle,
} from "./Panel";

/**
 * The client's requests, as rows in the portal's list panel.
 *
 * It was a five-column table, and the columns were costing more than they
 * bought: `Owner` and `Updated` were the first two things a phone truncated,
 * which are the two facts a client opens this screen to check — who is holding
 * it, and whether it has moved. As a row they sit on the line under the title
 * where there is room for them at any width.
 */
export function RequestTable({
  requests,
  emptyTitle = "No requests yet",
  emptyBody = "Anything you need coordinated starts here.",
  emptyAction,
}: {
  requests: PortalRequest[];
  emptyTitle?: string;
  emptyBody?: string;
  /** Omitted where the reader may not create one, so the state does not offer it. */
  emptyAction?: { label: string; href: string };
}) {
  if (requests.length === 0) {
    return <PanelEmpty glyph="◷" title={emptyTitle} detail={emptyBody} action={emptyAction} />;
  }

  return (
    <PanelRows>
      {requests.map((request) => {
        const urgency = urgencyView(request.urgency);
        const health = healthView(request.health);
        const done = request.status === "completed";

        return (
          <PanelRow
            key={request.id}
            href={`/client-portal/requests/${request.id}`}
            when={relativeTime(request.updatedAt)}
            dim={done}
          >
            <PanelBody>
              <PanelTitle>{request.title}</PanelTitle>

              {/* Who is holding it, and where it has got to. The client's own
                  question on this screen is as often "who do I chase?" as
                  "where has it got to?", and the name was on the detail page
                  only. */}
              <PanelMeta>
                {request.nextStep ?? "Nothing yet"}
                {" · "}
                {request.ownerName ?? "Your team"}
              </PanelMeta>

              <PanelTags>
                <StatusPill status={REQUEST_STATUS[request.status]} />
                {/* Urgency and health only appear when they are worth saying —
                    see `urgencyView`/`healthView`. A row where everything is
                    ordinary stays exactly as it was. */}
                {urgency ? <Pill tone={urgency.tone}>{urgency.label}</Pill> : null}
                {health ? <Pill tone={health.tone}>{health.label}</Pill> : null}
              </PanelTags>
            </PanelBody>
          </PanelRow>
        );
      })}
    </PanelRows>
  );
}
