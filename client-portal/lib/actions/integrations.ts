"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/base/lib/supabase/service";
import {
  isIntegrationKey,
  providerMeta,
  settingsFor,
  type ChosenSource,
} from "@/client-portal/lib/integrations/catalog";
import { disconnect } from "@/client-portal/lib/integrations/connection";
import { saveSources, type MailProvider } from "@/client-portal/lib/integrations/mail";
import { syncGmail } from "@/client-portal/lib/integrations/gmail";
import { syncGoogleCalendar } from "@/client-portal/lib/integrations/google-calendar";
import { syncOutlookMail } from "@/client-portal/lib/integrations/outlook-mail";
import { syncOutlookCalendar } from "@/client-portal/lib/integrations/outlook-calendar";
import { requireRead, toastUrl } from "./guard";

const PATH = "/client-portal/integrations";

/** The two that keep a list of people. Both calendars read the whole calendar. */
function mailProvider(key: string): MailProvider | null {
  return key === "gmail" || key === "outlook_mail" ? key : null;
}

/**
 * Read one connection, now, on whichever provider it is.
 *
 * The one place that knows all four. `null` is a provider nothing reads —
 * which is none of them today, and is kept because `syncs: false` is still a
 * state the catalog can express.
 */
async function runSync(key: string, contactId: string, timeZone: string) {
  if (key === "gmail") return syncGmail(contactId);
  if (key === "outlook_mail") return syncOutlookMail(contactId);
  if (key === "google_calendar") return syncGoogleCalendar(contactId, timeZone);
  if (key === "outlook_calendar") return syncOutlookCalendar(contactId, timeZone);
  return null;
}

/**
 * Manage and Disconnect — the two actions `whitbyos/integrations/actions.ts`
 * has, for a person's own connections.
 *
 * Guarded by the Integrations area and a live identity, and not by view-only.
 * View-only is about the client *account* — its Requests, its documents — and a
 * person connecting their own calendar changes nothing on the account; refusing
 * it would stop a read-only member from seeing their own dentist appointment.
 */
async function guard(back: string) {
  const result = await requireRead("integrations");
  if ("reason" in result) redirect(toastUrl(back, result.reason));
  return result.ctx;
}

function parseSources(raw: FormDataEntryValue | null): ChosenSource[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ChosenSource[]) : [];
  } catch {
    return [];
  }
}

export async function saveIntegrationSettings(formData: FormData) {
  const key = String(formData.get("provider") ?? "");
  if (!isIntegrationKey(key)) redirect(toastUrl(PATH, "That service can't be managed here."));

  const manageHref = `${PATH}?manage=${key}`;
  const ctx = await guard(manageHref);
  const supabase = createServiceClient();
  if (!supabase) redirect(toastUrl(manageHref, "Could not save. Please try again."));

  const settings: Record<string, boolean> = {};
  for (const setting of settingsFor(key)) {
    settings[setting.key] = formData.get(setting.key) === "on";
  }

  const { error } = await supabase
    .from("client_portal_integrations")
    .update({ sync_settings: settings, updated_at: new Date().toISOString() })
    .eq("contact_id", ctx.contactId)
    .eq("provider", key)
    .neq("status", "disconnected");

  if (error) redirect(toastUrl(manageHref, "Could not save. Please try again."));

  const mailbox = mailProvider(key);
  if (mailbox) {
    const saved = await saveSources(ctx, mailbox, parseSources(formData.get("sources")));
    if (!saved.ok) redirect(toastUrl(manageHref, "Could not save who may be read. Please try again."));
  }

  // The reading happens after the response, so Save answers at once. A
  // mailbox or calendar that cannot be read says so on its row afterwards.
  const contactId = ctx.contactId;
  const timeZone = ctx.timezone;
  after(() => runSync(key, contactId, timeZone).then(() => undefined));

  redirect(toastUrl(PATH, `${providerMeta(key)?.name ?? "Settings"} saved.`));
}

export async function disconnectIntegration(formData: FormData) {
  const key = String(formData.get("provider") ?? "");
  if (!isIntegrationKey(key)) redirect(toastUrl(PATH, "That service can't be disconnected here."));

  const ctx = await guard(PATH);
  const result = await disconnect(ctx.contactId, key);
  if (!result.ok) redirect(toastUrl(`${PATH}?disconnect=${key}`, "Could not disconnect. Please try again."));

  redirect(toastUrl(PATH, `${providerMeta(key)?.name ?? "It"} is disconnected.`));
}

/**
 * Where to come back to, from the screen the button was pressed on.
 *
 * Taken from the form rather than guessed, so Sync now on Email returns to the
 * person and search that were on the screen. Checked against the portal's own
 * prefix because it becomes a redirect target, and the existing toast is
 * dropped so two presses do not stack two messages on the URL.
 */
function backTo(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  if (!value.startsWith("/client-portal")) return PATH;

  const [path, query] = value.split("?");
  const params = new URLSearchParams(query ?? "");
  params.delete("toast");
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

/**
 * Sync now — reading the mailbox while the client waits, rather than after.
 *
 * `syncGmailIfStale` on the header does the background half: it runs in
 * `after()`, so it reads *once the page has already been sent*. A refresh
 * therefore shows what the previous visit found, and inside the ten-minute
 * throttle it shows nothing new at all — which is not what someone pressing
 * refresh after an email arrives is asking for.
 *
 * So this runs the same sync inline and redirects when it is done. The screen
 * that comes back is drawn from what was just read, and the toast says what
 * that was. No throttle: the press is the request.
 */
export async function syncIntegrationNow(formData: FormData) {
  const key = String(formData.get("provider") ?? "");
  const back = backTo(formData.get("back"));

  if (!isIntegrationKey(key)) redirect(toastUrl(back, "That service can't be synced here."));

  const ctx = await guard(back);

  const outcome = await runSync(key, ctx.contactId, ctx.timezone);

  // A provider the catalog marks `syncs: false` is connected and read by
  // nothing. Saying so is better than a button that reports success having
  // done nothing at all.
  if (!outcome) redirect(toastUrl(back, `${providerMeta(key)?.name ?? "That service"} isn't read yet.`));

  if (!outcome.ok) {
    redirect(toastUrl(back, "Could not check just now. Please try again in a moment."));
  }

  const found = outcome.count ?? 0;
  const noun = mailProvider(key) ? "message" : "event";

  redirect(
    toastUrl(
      back,
      found === 0
        ? "Checked — nothing new since the last look."
        : `Checked — ${found} new ${noun}${found === 1 ? "" : "s"}.`,
    ),
  );
}
