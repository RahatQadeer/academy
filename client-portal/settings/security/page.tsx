import { Input } from "@/base/components/Input";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { changePassword } from "@/client-portal/lib/actions/settings";
import { MIN_PASSWORD_LENGTH } from "@/client-portal/lib/password";
import { Row, RowList, RowMeta } from "@/client-portal/components/Surface";
import { BUTTON_SIZE } from "@/client-portal/components/buttons";
import { DataNotice } from "@/client-portal/components/DataNotice";
import { FieldGroup, FormActions } from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { SettingsShell } from "../components/SettingsShell";

export default async function SecuritySettingsScreen() {
  const context = await getPortalContext();

  return (
    <SettingsShell
      active="security"
      title="Security"
      description="Basic controls for your login."
    >
      <DataNotice context={context} />

      <section>
        <h2 className="mb-4 text-[15px] font-semibold">Change password</h2>
        <form action={changePassword}>
          <FieldGroup>
            <Input
              label="New password"
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              // Said before the press rather than only after it. The rule is
              // enforced by Supabase, which is the only party that knows the
              // current password — but a client who types their existing one
              // and is refused should have been told first.
              hint={`At least ${MIN_PASSWORD_LENGTH} characters, and different from your current password.`}
            />
            <Input
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
            />
          </FieldGroup>
          <FormActions>
            <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
          </FormActions>
        </form>
      </section>

      {/* Ruled off below the form, as Whitby's Profile rules off its account
          section: a different kind of thing, not more of the same. */}
      <section className="mt-10 border-t border-line pt-7">
        <h2 className="mb-3 text-[15px] font-semibold">This session</h2>
        <RowList>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">Signed in as</div>
              <RowMeta>{context.email ?? "Not set"}</RowMeta>
            </div>
          </Row>
          <Row>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-medium">Sign out</div>
              <RowMeta>Ends this session on this device.</RowMeta>
            </div>
            {/* Posts to base's shared auth route — the portal never forks sign-out. */}
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className={`rounded-control border border-line-strong font-medium transition-colors hover:bg-surface-soft ${BUTTON_SIZE.row}`}
              >
                Sign out
              </button>
            </form>
          </Row>
        </RowList>
      </section>
    </SettingsShell>
  );
}
