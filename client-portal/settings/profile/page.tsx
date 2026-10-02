import { Input } from "@/base/components/Input";
import { createClient } from "@/base/lib/supabase/server";
import { getPortalContext } from "@/client-portal/lib/portal-context";
import { saveProfile } from "@/client-portal/lib/actions/settings";
import { restartPortalTour } from "@/client-portal/lib/actions/tour";
import { avatarStoragePath } from "@/client-portal/lib/storage";
import { DataNotice } from "@/client-portal/components/DataNotice";
import {
  FieldGroup,
  FormActions,
  Select,
  Textarea,
  Wide,
} from "@/client-portal/components/Fields";
import { SubmitButton } from "@/client-portal/components/SubmitButton";
import { SettingsShell } from "../components/SettingsShell";
import { AvatarUpload } from "./components/AvatarUpload";

const SALUTATIONS = ["Dr.", "Mr.", "Mrs.", "Ms.", "Mx.", "Sir", "Dame"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "UTC",
];

/**
 * What this pane is currently showing, read back from the two rows
 * `saveProfile` writes.
 *
 * The bug this fixes: the form wrote every one of these fields and read almost
 * none of them back. Preferred name, salutation, phone and time zone had no
 * `defaultValue` at all, so they rendered empty on every visit — a client who
 * saved a phone number saw the field blank the next time they opened the page
 * and reasonably concluded it had not saved. It had; nothing ever asked for it.
 *
 * `contacts` is preferred over `users` for the person's own details, because it
 * is the canonical person record and the one the professional's side reads.
 * `timezone` comes from `users` because that is the only row carrying it.
 */
type ProfileValues = {
  photoUrl: string | null;
  fullName: string;
  preferredName: string;
  salutation: string;
  phone: string;
  mailingAddress: string;
  timezone: string;
};

async function readProfile(contactId: string | null, userId: string | null) {
  const empty: Omit<ProfileValues, "fullName"> & { fullName: string | null } = {
    photoUrl: null,
    fullName: null,
    preferredName: "",
    salutation: "",
    phone: "",
    mailingAddress: "",
    timezone: "",
  };
  if (!contactId) return empty;

  const supabase = await createClient();
  const [{ data: signed }, { data: contact }, { data: user }] = await Promise.all([
    supabase.storage
      .from("avatars")
      .createSignedUrl(avatarStoragePath(contactId), 3600),
    supabase
      .from("contacts")
      .select("first_name, last_name, preferred_name, salutation, phone, enrichment_data")
      .eq("id", contactId)
      .maybeSingle(),
    // `users_select_self` covers this: a client is an auth user reading their
    // own row. Skipped entirely for a session with no user id.
    userId
      ? supabase
          .from("users")
          .select("timezone, preferred_name, salutation, phone")
          .eq("id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const enrichment = contact?.enrichment_data as Record<string, unknown> | null;
  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");

  return {
    photoUrl: signed?.signedUrl ?? null,
    fullName: name || null,
    preferredName: contact?.preferred_name ?? user?.preferred_name ?? "",
    salutation: contact?.salutation ?? user?.salutation ?? "",
    phone: contact?.phone ?? user?.phone ?? "",
    mailingAddress:
      typeof enrichment?.mailing_address === "string" ? enrichment.mailing_address : "",
    timezone: user?.timezone ?? "",
  };
}

export default async function ProfileSettingsScreen() {
  const context = await getPortalContext();
  const saved = await readProfile(context.contactId, context.userId ?? null);

  // The name on the contact record, falling back to whatever the session is
  // called — a demo session has no contact row to read.
  const fullName = saved.fullName ?? context.displayName;

  /*
   * A saved zone the list does not offer is still the saved zone.
   *
   * `TIMEZONES` is nine common ones, and `users.timezone` can hold any IANA
   * name — set by the professional, or by an earlier version of this list. A
   * `<select>` given a value none of its options carry falls back to the first
   * option, so the page would have shown "Select a time zone" over a zone that
   * was set, and saving anything else would have silently overwritten it.
   */
  const zones = saved.timezone && !TIMEZONES.includes(saved.timezone)
    ? [saved.timezone, ...TIMEZONES]
    : TIMEZONES;

  return (
    <SettingsShell
      active="profile"
      title="Profile & Contact"
      description="How your team reaches you. Kept deliberately short, anything deeper lives in the rest of these settings."
    >
      <DataNotice context={context} />
      <AvatarUpload name={fullName} photoUrl={saved.photoUrl} />
      {/*
       * Paired, not stacked.
       *
       * Seven full-width fields is seven rows and a scrollbar on a laptop, for
       * a pane whose longest answer is a phone number. The ones that read as a
       * pair share a line; the two that do not — an email with a sentence of
       * explanation under it, and an address of three lines — take the width
       * they need. Below 640px it is one column again, which is the only shape
       * a phone has room for.
       */}
      <form action={saveProfile}>
        <FieldGroup cols={2}>
          <Input
            label="Full name"
            name="fullName"
            defaultValue={fullName}
            required
            maxLength={120}
          />
          <Input
            label="Preferred name"
            name="preferredName"
            defaultValue={saved.preferredName}
            maxLength={80}
          />
          <Select
            label="Salutation"
            name="salutation"
            placeholder="None"
            defaultValue={saved.salutation}
            options={SALUTATIONS.map((value) => ({ value, label: value }))}
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            defaultValue={saved.phone}
            maxLength={40}
          />
          <Wide>
            <Input
              label="Email address"
              name="email"
              type="email"
              defaultValue={context.email ?? ""}
              readOnly
              hint="Your email is your sign-in. Ask your team if it needs to change."
            />
          </Wide>
          <Wide>
            <Textarea
              label="Mailing address"
              name="mailingAddress"
              rows={2}
              defaultValue={saved.mailingAddress}
            />
          </Wide>
          <Wide>
            <Select
              label="Time zone"
              name="timezone"
              placeholder="Select a time zone"
              defaultValue={saved.timezone}
              options={zones.map((value) => ({
                value,
                label: value.replace(/_/g, " "),
              }))}
            />
          </Wide>
        </FieldGroup>

        <FormActions>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </FormActions>
      </form>

      {/*
       * The way back into the welcome tour, which its closing card promises.
       *
       * On this pane rather than on Preferences, where the promise first read:
       * Preferences is one of the three panes `SettingsShell` keeps off the
       * rail for now, so the only pointer to the tour would have been to a
       * screen with no link to it.
       *
       * Its own form under the fields, not a field: pressing it leaves the
       * screen, and nothing about it belongs in a Save.
       */}
      <form
        action={restartPortalTour}
        className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t pt-5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium">New to the portal?</div>
          <div className="text-[12.5px]" style={{ color: "var(--text-soft)" }}>
            Run the six-step tour of the sidebar, the top bar and your dashboard again.
          </div>
        </div>
        <SubmitButton variant="secondary" pendingLabel="Opening…">
          Show me around again
        </SubmitButton>
      </form>
    </SettingsShell>
  );
}
