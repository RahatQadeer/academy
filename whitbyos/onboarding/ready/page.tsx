import type { ReactNode } from "react";
import { getSessionProfile } from "@/base/identity/session";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { OnboardingShell } from "@/whitbyos/onboarding/components/OnboardingShell";
import { getWorkspaceLogoUrl } from "@/whitbyos/lib/logo";
import { getWorkTypes } from "@/whitbyos/lib/onboarding";
import { usesClientWorkspaces } from "@/whitbyos/lib/client-workspace";
import { WHITBY_ENTRY } from "@/base/switcher/products";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  team_lead: "Team Lead",
  coordinator: "Coordinator",
  billing: "Billing",
  viewer: "Viewer",
};

const CARD =
  "rounded-[14px] shadow-[inset_0_0_0_1px_var(--chrome-line),0_10px_24px_-20px_rgba(15,32,56,.22)]";

type PendingInvite = {
  invitee_email: string;
  role_or_relationship: string | null;
};

async function pendingInvites(workspaceId: string): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invitations")
    .select("invitee_email, role_or_relationship")
    .eq("context_type", "team_member")
    .eq("context_id", workspaceId)
    .eq("status", "pending")
    .order("sent_at", { ascending: false });

  return (data ?? []) as PendingInvite[];
}

/** SRS §4.5 — confirm what was created, offer integrations, then enter Whitby. */
export default async function ReadyPage() {
  const profile = isSupabaseConfigured() ? await getSessionProfile() : null;
  const workspace = profile?.workspaces[0];
  const invites = workspace ? await pendingInvites(workspace.id) : [];
  const logoUrl = await getWorkspaceLogoUrl(workspace?.logo_url);
  const workTypes = await getWorkTypes();
  const clientWorkspaces = await usesClientWorkspaces();

  return (
    <OnboardingShell
      step={null}
      width={640}
      title="You're all set"
      workspace={workspace ? { name: workspace.name, logoUrl } : null}
      centeredHeader={
        <div className="flex flex-col items-center gap-3 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${workspace?.name ?? "Workspace"} logo`}
              className="h-12 w-12 rounded-[12px] border border-line object-cover"
            />
          ) : (
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-bold"
              style={{ background: "var(--success-bg, #e1f5ea)", color: "var(--success-fg)" }}
              aria-hidden
            >
              ✓
            </span>
          )}
          <h1 className="text-[22px] font-bold tracking-[-0.3px]">You&apos;re all set</h1>
          <p className="text-[13.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
            Here&apos;s a quick summary of your new workspace.
          </p>
        </div>
      }
      footer={
        <div className="flex justify-end">
          <a
            href={WHITBY_ENTRY}
            className="inline-flex items-center rounded-control px-6 py-[11px] text-[14px] font-semibold text-white no-underline hover:!text-white"
            style={{
              background: "var(--accent)",
              boxShadow: "0 8px 18px -12px rgba(31,72,125,.9)",
            }}
          >
            Get Started
          </a>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <SummaryRow
          title="Workspace created"
          detail={
            workspace
              ? `${workspace.name} · whitby.app/${workspace.url_slug}`
              : "Your workspace is ready."
          }
        />

        <SummaryRow
          title={clientWorkspaces ? "Workspaces on" : "Workspaces off"}
          detail={
            clientWorkspaces
              ? "Each client relationship has its own workspace. Add clients anytime from Clients."
              : "You are working as one organization. Turn Workspaces on later from Settings, Workspace."
          }
        />

        {invites.length > 0 ? (
          <SummaryRow
            title={`${invites.length} ${invites.length === 1 ? "teammate" : "teammates"} invited`}
          >
            <div className="mt-2 flex flex-wrap gap-1.5">
              {invites.map((invite) => (
                <span
                  key={`${invite.invitee_email}-${invite.role_or_relationship}`}
                  className="max-w-full rounded-full px-2.5 py-[5px] text-[12px] font-medium leading-snug"
                  style={{ background: "var(--accent-tint)", color: "var(--accent)" }}
                >
                  <span className="break-all">{invite.invitee_email}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>
                    {" "}
                    · {ROLE_LABELS[invite.role_or_relationship ?? ""] ?? "Coordinator"}
                  </span>
                </span>
              ))}
            </div>
          </SummaryRow>
        ) : null}

        {workTypes.length > 0 ? (
          <SummaryRow
            title={`${workTypes.length} work ${workTypes.length === 1 ? "type" : "types"} selected`}
          >
            <div className="mt-2 flex flex-wrap gap-1.5">
              {workTypes.map((type) => (
                <span
                  key={type}
                  className="rounded-full px-2.5 py-[5px] text-[12px] font-medium"
                  style={{ background: "var(--canvas)", color: "var(--ink)" }}
                >
                  {type}
                </span>
              ))}
            </div>
          </SummaryRow>
        ) : null}
      </div>
    </OnboardingShell>
  );
}

function SummaryRow({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${CARD} flex items-start gap-3.5 px-4 py-4`} style={{ background: "#ffffff" }}>
      <span
        aria-hidden
        className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: "var(--success-bg, #e1f5ea)", color: "var(--success-fg)" }}
      >
        ✓
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold tracking-[-0.15px]">{title}</div>
        {detail ? (
          <div
            className="mt-0.5 break-words text-[12.5px] leading-snug"
            style={{ color: "var(--text-tertiary)" }}
          >
            {detail}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
