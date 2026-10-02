import { Modal } from "@/whitbyos/components/Modal";
import { ReviewAccessForm } from "@/whitbyos/clients/[id]/components/ReviewAccessForm";
import { ACCESS_AREAS, GRANT_ROLES } from "@/whitbyos/lib/access-requests-vocab";
import { shortDate } from "@/whitbyos/lib/format";
import type { AccessRequest } from "@/whitbyos/lib/client-detail";

/**
 * Screen 2.1.2.1 — Review access request (SRS §4.9).
 *
 * The client may ask; the professional decides. That is the whole shape of it,
 * and why §4.9.2 holds the invitation back until this screen has been answered.
 *
 * The screen shows what was asked for and offers three answers: decline,
 * cancel, or approve and send the invitation. It does not offer to edit the
 * request.
 *
 * It used to. The role was a select and every area a tick box, so the same
 * screen both reported what the client had decided and quietly invited
 * somebody else to decide it again — and a screen that can be changed is one
 * that has to be read carefully before every press. The account's own primary
 * contact says who may see what; this says yes or no to that, and shows it
 * plainly enough to answer with.
 *
 * Changing what somebody may reach is a separate act, on their own row under
 * Contacts, and not something done in passing while approving an invitation.
 */
export function ReviewAccessDialog({
  request,
  clientId,
  closeHref,
  defaultAreas,
}: {
  /** What this workspace starts a new portal person with, from Settings →
      Workspace. Used only where the request itself recorded no areas. */
  defaultAreas: string[];
  request: AccessRequest;
  clientId: string;
  closeHref: string;
}) {
  const asked = request.requestedAreas;

  /* The label for what the client chose, when this screen can grant it. A
     request for a role the screen does not offer says so rather than opening
     silently on the first option in the list. */
  const requestedLabel =
    GRANT_ROLES.find((role) => role.value === request.requestedRole)?.label ??
    (request.requestedRole ? `${request.requestedRole}, not offered here` : null);

  /* A Dependent has no login, so the areas below would be a list of things a
     person who can never open the portal may do. */
  const noLogin = request.requestedRole === "dependent";

  /*
   * What this account chose, in the order the areas are written.
   *
   * A request with no areas recorded falls back to the workspace's defaults,
   * because nobody chose those; a request with an empty list did choose, and
   * chose none.
   */
  const granted = ACCESS_AREAS.filter((area) =>
    asked ? asked.includes(area.key) : defaultAreas.includes(area.key),
  );

  return (
    <Modal title="Review access request" closeHref={closeHref} width={520}>
      <div className="flex flex-col gap-[18px]">
        <div
          className="flex items-center gap-3 rounded-[8px] p-3"
          style={{ background: "var(--surface-soft)" }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
            style={{ background: "var(--canvas)", color: "var(--text-secondary)" }}
          >
            {request.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{request.personName}</div>
            <div className="truncate text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
              {[request.personEmail, request.relationship].filter(Boolean).join(" · ") ||
                "No details given"}
            </div>
          </div>
        </div>

        <div className="text-[12.5px]" style={{ color: "var(--text-secondary)" }}>
          Requested by {request.requestedBy ?? "a member of this account"} on{" "}
          {shortDate(request.createdAt)}
        </div>

        {/* Not in the export, which has no field for it — but the portal asks
            for a reason and it is the one thing that makes the decision
            answerable rather than a guess. */}
        {request.reason ? (
          <div
            className="rounded-[8px] border border-line px-3.5 py-3 text-[13px] leading-[1.6]"
            style={{ color: "var(--text-secondary)" }}
          >
            “{request.reason}”
          </div>
        ) : null}

        <ReviewAccessForm
          requestId={request.id}
          clientId={clientId}
          closeHref={closeHref}
        >
          {/* The role as asked for, carried to the action rather than chosen
              again here. */}
          <input
            type="hidden"
            name="grant_role"
            value={request.requestedRole ?? "additional_member"}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
              Role asked for
            </span>
            <div
              className="rounded-control border px-2.5 py-[9px] text-[13.5px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-soft)",
                color: "var(--ink)",
              }}
            >
              {requestedLabel ?? "Member, view and comment"}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-medium" style={{ color: "var(--text-tertiary)" }}>
                {noLogin ? "Access, if they are given a login" : "Access asked for"}
              </span>
              <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                {asked
                  ? "Chosen by this account"
                  : "This request predates the areas field"}
              </span>
            </div>

            {/*
              * Only what they are being given.
              *
              * Nine rows with four ticks in them is a form to be checked; the
              * question on this screen is "is this all right", and the answer
              * is easier to reach from four lines than from nine with five of
              * them crossed out. What is not listed is not granted, which is
              * the plainer half of the same fact.
              */}
            <div className="flex flex-col gap-0.5">
              {granted.length === 0 ? (
                <span className="px-1 py-2 text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                  No areas asked for. {request.personName.split(" ")[0]} would join the
                  account with nothing open to them.
                </span>
              ) : (
                granted.map((area) => (
                  <div
                    key={area.key}
                    className="flex items-center gap-2.5 px-1 py-2 text-[13.5px]"
                    style={{ color: "var(--ink)" }}
                  >
                    {/* The answer travels with the form; the mark beside it is
                        a statement, not a control. */}
                    <input type="hidden" name={area.key} value="on" />

                    <span
                      aria-hidden
                      className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] text-[10px] font-bold"
                      style={{ background: "var(--accent)", color: "#fff" }}
                    >
                      ✓
                    </span>
                    <span className="flex-1">{area.label}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-[12px] leading-[1.5]" style={{ color: "var(--text-tertiary)" }}>
            {/*
             * Both halves named, because both happen.
             *
             * It was shortened to "Approve" on the reasoning that approving
             * and inviting are one act — true, but the short word left the
             * sending invisible, and what leaves the building matters more
             * than the tidiness of the label. An email really does go: the
             * project sends through its own SMTP, and the link in it is where
             * they set a password.
             */}
            {request.personName.split(" ")[0]} joins this account at the level
            above, and an email goes to them with a link to the Client Portal
            where they set their own password. The link is on their row under
            Contacts if it needs sending again. Declining leaves the account
            exactly as it is.
          </p>
        </ReviewAccessForm>
      </div>
    </Modal>
  );
}
