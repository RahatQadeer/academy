import Link from "next/link";
import { Button } from "@/base/components/Button";
import { Submit } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { Pill } from "@/base/components/Pill";
import { Modal } from "@/whitbyos/components/Modal";
import { Toast } from "@/whitbyos/components/Toast";
import { SettingsShell } from "@/whitbyos/settings/components/SettingsShell";
import { TeamRowMenu } from "@/whitbyos/settings/components/TeamRowMenu";
import { CONTROL, Field } from "@/whitbyos/settings/components/Fields";
import { inviteTeammate } from "@/whitbyos/settings/actions";
import { listTeam } from "@/whitbyos/lib/settings";
import { INVITABLE_ROLES, ROLE_LABELS, mayAdminister } from "@/whitbyos/lib/settings-vocab";

const PATH = "/whitbyos/settings/team";
// The last column carries Resend beside the ⋯ on an invited row, so it takes a
// little back from Status — which holds one pill and had room to spare.
const GRID = "grid-cols-[2fr_2.2fr_1.3fr_0.8fr_1fr]";

/** The four colourways the export cycles down the list. */
const TONES = [
  { background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" },
  { background: "var(--avatar-blue-bg)", color: "var(--avatar-blue-fg)" },
  { background: "var(--avatar-green-bg)", color: "var(--avatar-green-fg)" },
  { background: "var(--avatar-orange-bg)", color: "var(--avatar-orange-fg)" },
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Screen 17.2 — Team & Access, with 17.2a over it. */
export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const team = await listTeam();

  const toast = one(searchParams?.toast);
  const error = one(searchParams?.error);
  const inviting = one(searchParams?.invite) === "1";

  // The rail shows a role label; the check needs the role itself.
  const myRole = team.find((row) => row.isSelf)?.role ?? null;
  const canAdminister = mayAdminister(myRole);

  return (
    <SettingsShell
      active="team"
      title="Team & Access"
      width={null}
      action={
        canAdminister ? (
          <Button unsized href={`${PATH}?invite=1`} variant="primary" className="px-4 py-[9px] text-[13.5px]">
            + Invite teammate
          </Button>
        ) : undefined
      }
    >
      {error ? (
        <div className="mb-5">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[8px] border border-line">
        <div
          className={`grid ${GRID} border-b border-line px-4 py-2.5 text-[11.5px] font-semibold`}
          style={{ background: "var(--surface-soft)", color: "var(--text-tertiary)" }}
        >
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span />
        </div>

        {team.map((member, index) => (
          <div
            key={member.userId ?? member.email}
            className={`grid ${GRID} items-center border-b border-line px-4 py-3 text-[13.5px] last:border-b-0`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="relative flex h-[22px] w-[22px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold"
                style={TONES[index % TONES.length]}
              >
                {member.initials}
                {member.userId && member.hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/avatar?id=${encodeURIComponent(member.userId)}`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
              </span>
              <span className="min-w-0 truncate">
                {member.name}
                {member.isSelf ? (
                  <span className="ml-1.5 text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>
                    you
                  </span>
                ) : null}
              </span>
            </span>

            <span className="min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>
              {member.email}
            </span>

            <span className="text-[12.5px] font-medium">{member.roleLabel}</span>

            <span>
              {member.status === "active" ? (
                <Pill tone="success">Active</Pill>
              ) : member.status === "invited" ? (
                <Pill tone="warning">Invited</Pill>
              ) : (
                <Pill tone="danger">Expired</Pill>
              )}
            </span>

            {canAdminister && !member.isSelf ? (
              <TeamRowMenu
                userId={member.userId}
                email={member.email}
                name={member.name}
                role={member.role}
                pending={member.status !== "active"}
              />
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>

      {/* §5.4 and §7.1.5, which the export prints verbatim under the table. */}
      <div className="mt-7">
        <div className="mb-1 text-[14px] font-semibold">Restricted records</div>
        <p className="max-w-[640px] text-[13px] leading-[1.5]" style={{ color: "var(--text-secondary)" }}>
          Records marked Restricted are visible only to named or explicitly
          permitted team members, regardless of role. Only Owners and Admins can
          change roles, access ceilings, and other high-risk settings.
        </p>
      </div>

      {inviting ? (
        <Modal title="Invite Teammate" closeHref={PATH} width={480} dense>
          <form action={inviteTeammate} className="flex flex-col gap-4">
            <Field label="Email address" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="name@company.com"
                className={CONTROL}
              />
            </Field>

            <Field label="Role" htmlFor="role">
              <select id="role" name="role" defaultValue="team_lead" className={CONTROL}>
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex justify-end gap-2.5">
              <Link
                href={PATH}
                className="rounded-control border border-line-strong px-4 py-[9px] text-[13.5px] font-medium no-underline"
                style={{ color: "var(--ink)" }}
              >
                Cancel
              </Link>
              <Submit unsized variant="primary" className="px-[18px] py-[9px] text-[13.5px]">
                Send Invite
              </Submit>
            </div>
          </form>
        </Modal>
      ) : null}

      {toast ? <Toast title="Invite sent" detail={toast} closeHref={PATH} /> : null}
    </SettingsShell>
  );
}
