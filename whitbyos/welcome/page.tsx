import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitPlain } from "@/base/components/Submit";
import { Callout } from "@/base/components/Callout";
import { createClient, isSupabaseConfigured } from "@/base/lib/supabase/server";
import { OnboardingShell } from "@/whitbyos/onboarding/components/OnboardingShell";
import { PhotoPicker } from "@/whitbyos/welcome/PhotoPicker";
import { dropWelcomePhoto } from "@/whitbyos/welcome/actions";

/**
 * Straight into Whitby, not the product switcher.
 *
 * This screen is only ever reached by accepting a team invitation, and that
 * invitation grants exactly one product. Ending on "Choose where to continue"
 * asked someone who had just been invited to Whitby, and entitled to nothing
 * else, to choose Whitby from four cards — three of which would have turned
 * them away.
 */
const CONTINUE = "/whitbyos/workspaces";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function initialsOf(name: string) {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * The one screen between accepting an invitation and the app.
 *
 * It has no counterpart in the export, which draws the invitation form and then
 * the app. The only photo control it draws anywhere is Settings → Profile, and
 * this reuses that one's wording and its two buttons rather than inventing a
 * second vocabulary for the same act.
 *
 * It asks for a photo and nothing else. Everything else about a teammate — name,
 * password, role — is already settled by the time they get here: the first two
 * on the invitation form, the third by whoever invited them. A photo is the one
 * thing only they can supply, and it is the one thing nothing breaks without.
 *
 * So it is genuinely optional, and says so. Skip for now is a real answer, not
 * a smaller button next to the real one, and Settings → Profile has carried the
 * same control all along for whenever they change their mind.
 *
 * Nobody is sent back here. Someone who skipped and reloads the app is not
 * asked again, because being asked twice is how an optional step stops reading
 * as optional. That does mean the screen is reachable exactly once per
 * invitation, by the redirect that accepting produces.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSupabaseConfigured()) redirect("/login");

  const query = (await searchParams) ?? {};
  const error = one(query.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("users")
    .select("full_name, preferred_name, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const name = (row?.preferred_name as string) || (row?.full_name as string) || "";
  const email = (row?.email as string) || user.email || "";
  const initials = initialsOf(name || email);
  const avatarUrl = (row?.avatar_url as string | null) ?? null;

  // Which sign-ins this account actually has, read from the session rather than
  // from `users.oauth_provider`. That column is written once, by the trigger
  // that creates the row, and an invited account is created by email — so it
  // says "email" for someone who linked Google a minute later, and the screen
  // would offer to upload a photo Google had already given them.
  const google = (user.identities ?? []).find((identity) => identity.provider === "google");
  const fromGoogle =
    avatarUrl !== null &&
    (avatarUrl === (google?.identity_data?.avatar_url as string | undefined) ||
      avatarUrl === (google?.identity_data?.picture as string | undefined));

  // A googleusercontent link is exactly the kind /api/avatar exists to proxy —
  // Google refuses plenty of them when a browser asks from somewhere else. An
  // uploaded photo is a signed URL on our own bucket and is drawn directly,
  // which also sidesteps the proxy's hour of caching on the one screen where
  // the photo can change twice in a minute.
  const photoSrc = fromGoogle ? `/api/avatar?id=${encodeURIComponent(user.id)}` : avatarUrl;

  return (
    <OnboardingShell
      step={null}
      width={500}
      lockHeight
      exit={null}
      title="Add a photo"
      subtitle="It goes beside your name on tasks, requests and messages, so the rest of the team can tell at a glance whose work is whose."
      footer={
        <div className="flex justify-end">
          <Link
            href={CONTINUE}
            className="inline-flex items-center rounded-control px-6 py-[11px] text-[14px] font-semibold text-white no-underline hover:!text-white"
            style={{
              background: "var(--accent)",
              boxShadow: "0 8px 18px -12px rgba(31,72,125,.9)",
            }}
          >
            {avatarUrl ? "Continue" : "Skip for now"}
          </Link>
        </div>
      }
    >
      {error ? <Callout tone="danger">{error}</Callout> : null}

      <div
        className="flex items-center gap-4 rounded-[14px] px-4 py-4"
        style={{
          background: "#f7f5f0",
          boxShadow: "inset 0 0 0 1px var(--chrome-line)",
        }}
      >
        <span
          className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[22px] font-bold"
          style={{ background: "var(--avatar-tan-bg)", color: "var(--avatar-tan-fg)" }}
        >
          {initials}
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-[-0.15px]">
            {name || email}
          </div>
          {name && email ? (
            <div className="truncate text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              {email}
            </div>
          ) : null}

          <div className="mt-3">
            {fromGoogle ? (
              // Google already gave us one, so there is nothing to ask for. The
              // offer to replace it belongs in Settings, not in the doorway.
              <p className="text-[13px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                This came across with your Google account, so there is nothing to
                add here.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <PhotoPicker label={avatarUrl ? "Change photo" : "Upload photo"} />
                {avatarUrl ? (
                  <form action={dropWelcomePhoto}>
                    <SubmitPlain
                      className="rounded-control border border-line-strong bg-surface px-3.5 py-[7px] text-[13px] font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      Remove
                    </SubmitPlain>
                  </form>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
        You can change this any time from Settings, Profile.
      </p>
    </OnboardingShell>
  );
}
