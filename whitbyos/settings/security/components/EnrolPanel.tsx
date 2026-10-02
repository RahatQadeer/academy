"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Callout } from "@/base/components/Callout";
import { createClient } from "@/base/lib/supabase/client";

/**
 * The QR code half of enrolling — and the enrolling itself.
 *
 * `enroll` hands out the QR and the secret once, in its own response, and
 * never again: `listFactors` returns a factor's id and status and no way back
 * to its code. So the server used to enrol one factor, redirect with its id,
 * and this panel would enrol a *second* one to get a QR it could draw — which
 * Supabase refused, leaving "the setup code could not be shown again" over an
 * empty square, and would have left the six digits being checked against a
 * factor nobody scanned.
 *
 * One enrolment, in the browser, whose own response is both the code on the
 * screen and the id the form verifies. Any half-finished attempt from a
 * previous visit is cleared first, so a second try is not refused by the
 * first one's leftovers.
 */
export function EnrolPanel({ error }: { error?: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Once, and once in development too: an effect that enrols is not a thing to
  // run twice, and Strict Mode mounts every effect a second time.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const supabase = createClient();

      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) {
        if (factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      /*
       * The issuer is what the authenticator app writes above the six digits.
       *
       * Left unsaid, Supabase uses the project's Site URL — which is
       * http://localhost:3000 — so the entry on somebody's phone was called
       * "localhost:3000", which names nothing, matches nothing they signed in
       * to, and looks like something to delete. It is the product's name.
       */
      const { data, error: enrolError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Whitby",
        friendlyName: "Authenticator app",
      });

      if (enrolError || !data) {
        setFailed(enrolError?.message ?? "Could not start setting up 2FA.");
        return;
      }

      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    })();
  }, []);

  async function check(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || checking) return;

    const entered = new FormData(event.currentTarget).get("code");
    const code = String(entered ?? "").replace(/\s/g, "");

    if (code.length !== 6) {
      setFailed("Enter the six digits from your authenticator app.");
      return;
    }

    setChecking(true);
    setFailed(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challenge) {
      setFailed(challengeError?.message ?? "Could not check that code.");
      setChecking(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      setFailed(verifyError.message);
      setChecking(false);
      return;
    }

    /*
     * The session is now at assurance level 2, and the screen behind this
     * still says "Not set up" — it was rendered before any of this happened.
     * `refresh` asks the server for it again; `replace` closes the dialog by
     * dropping the ?setup from the URL.
     */
    router.replace(
      `/whitbyos/settings/security?toast=${encodeURIComponent(
        "Two-factor authentication is on. You will be asked for a code next time you sign in.",
      )}`,
    );
    router.refresh();
  }

  return (
    <div>
      <p className="-mt-2 mb-4 text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)" }}>
        Scan this with an authenticator app, Google Authenticator, 1Password,
        Authy, then type the six digits it shows.
      </p>

      {failed ? (
        <div className="mb-4">
          <Callout tone="danger">{failed}</Callout>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <Callout tone="danger">{error}</Callout>
        </div>
      ) : null}

      <div className="mb-4 flex justify-center">
        {qr ? (
          // A data: URI from Supabase, so nothing external is fetched.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Two-factor setup code" className="h-[180px] w-[180px]" />
        ) : (
          <div
            className="flex h-[180px] w-[180px] items-center justify-center rounded-[8px] border border-line text-[12.5px]"
            style={{ color: "var(--text-tertiary)" }}
          >
            {failed ? "Unavailable" : "Loading…"}
          </div>
        )}
      </div>

      {/*
       * Said out loud, because it bites.
       *
       * A code can only be handed out at the moment a factor is created, so
       * every time this dialog opens it makes a new one and the previous
       * unverified attempt is dropped. Anybody who scanned an earlier one is
       * then reading six digits for a factor that no longer exists — which
       * looks exactly like typing them wrong.
       */}
      {qr ? (
        <p
          className="mb-4 text-center text-[11.5px] leading-[1.5]"
          style={{ color: "var(--text-tertiary)" }}
        >
          Scanned this screen before? Delete that entry in your app first.
          This code replaces it.
        </p>
      ) : null}

      {secret ? (
        <p className="mb-4 text-center text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          Can&apos;t scan? Enter this instead:{" "}
          <span className="font-mono" style={{ color: "var(--ink)" }}>
            {secret}
          </span>
        </p>
      ) : null}

      {/*
       * Checked here rather than by a server action, and this is not a style
       * choice.
       *
       * A wrong code used to redirect back to this page with the error in the
       * URL, which remounted the panel — and the panel enrols. So one mistyped
       * digit threw away the factor that had just been scanned and drew a
       * fresh QR: the code in the authenticator app was then for a factor that
       * no longer existed, and every further attempt was "invalid" for good.
       *
       * Staying in place keeps the factor. Wrong codes are wrong codes, and
       * you can try again with the same app entry.
       */}
      <form onSubmit={check} className="flex flex-col gap-4">
        <label className="block">
          <span
            className="mb-1.5 block text-[12px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Six-digit code
          </span>
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123456"
            className="w-full rounded-control border border-line-strong bg-surface px-2.5 py-[9px] text-center font-mono text-[17px] tracking-[0.3em]"
          />
        </label>

        <button
          type="submit"
          disabled={!factorId || checking}
          className="rounded-control px-[18px] py-[9px] text-[13.5px] font-medium text-white transition-colors disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {checking ? "Checking…" : "Turn on 2FA"}
        </button>
      </form>
    </div>
  );
}
