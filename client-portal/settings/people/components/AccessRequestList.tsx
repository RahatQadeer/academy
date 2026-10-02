import { Pill } from "@/base/components/Pill";
import { AREA_LABEL } from "@/client-portal/lib/access";
import { relativeTime } from "@/client-portal/lib/format";
import { Row, RowMeta } from "@/client-portal/components/Surface";
import type { AccessRequest } from "@/client-portal/types";

const STATUS = {
  pending: { label: "Pending review", tone: "warning" },
  approved_as_requested: { label: "Approved", tone: "success" },
  approved_edited: { label: "Approved with changes", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
} as const;

/**
 * The asks that have been answered.
 *
 * Bare rather than in a `RowList` of its own: it is only ever drawn inside the
 * band at the foot of People & Access, and a bordered card inside a bordered
 * band is a box drawn twice.
 */
export function AccessRequestList({ requests }: { requests: AccessRequest[] }) {
  return (
    <div className="divide-y divide-line">
      {requests.map((request) => {
        const status = STATUS[request.status];
        return (
          <Row key={request.id}>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium">
                {request.personName}
                {request.requestedRole ? (
                  <span className="font-normal"> · {request.requestedRole}</span>
                ) : null}
              </div>
              <RowMeta>
                {[
                  request.personEmail,
                  request.relationship,
                  `Sent ${relativeTime(request.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </RowMeta>
              {/* What was asked for, not what was granted. The professional
                  sets the real permissions on approval and may narrow these,
                  so the row says "Asked for" while it is still pending and
                  points at Your access once it is not. */}
              {request.requestedAreas.length > 0 ? (
                <RowMeta>
                  {request.status === "pending" ? "Asked for: " : "Was asked for: "}
                  {request.requestedAreas
                    .map((area) => AREA_LABEL[area])
                    .join(", ")}
                </RowMeta>
              ) : null}
            </div>
            <Pill tone={status.tone}>{status.label}</Pill>
          </Row>
        );
      })}
    </div>
  );
}
