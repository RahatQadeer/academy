"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { getCurrentWorkspaceId } from "@/whitbyos/lib/workspace";
import { PROVIDERS, type ProviderKey } from "@/whitbyos/lib/integrations";
import { settingsFor } from "@/whitbyos/lib/integrations-vocab";
import { GOOGLE_PROVIDER, revokeGoogleGrant } from "@/whitbyos/lib/google-calendar";
import { GMAIL_PROVIDER, normalizeEmail, revokeGmailGrant } from "@/whitbyos/lib/gmail";
import { loadGmailPicker, type GmailSelectedSource } from "@/whitbyos/lib/gmail-context";
import { saveGmailSources, syncGmailContext } from "@/whitbyos/lib/gmail-sync";
import type { DialogResult } from "@/whitbyos/components/DialogForm";
import { readOnlyDialogResult } from "@/whitbyos/lib/read-only";

const LIST = "/whitbyos/integrations";
const ROUTE = "/[product]/[[...slug]]";

function backWithError(message: string): never {
  redirect(`${LIST}?error=${encodeURIComponent(message)}`);
}

function isProvider(value: string): value is ProviderKey {
  return PROVIDERS.some((provider) => provider.key === value);
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseGmailSources(raw: string): GmailSelectedSource[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as GmailSelectedSource[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/** Screen 16.2's Save — the switches, not the connection. */
export async function saveSyncSettings(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const provider = String(formData.get("provider") ?? "").trim();
  if (!isProvider(provider)) {
    return { ok: false, error: "That integration is not one Whitby supports." };
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  const settings: Record<string, boolean> = {};
  for (const setting of settingsFor(provider)) {
    settings[setting.key] = formData.get(setting.key) === "on";
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_integrations")
    .update({ sync_settings: settings })
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);

  if (error) return { ok: false, error: error.message };

  if (provider === GMAIL_PROVIDER) {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, error: "Sign in to save who Whitby may read." };

    const picker = await loadGmailPicker();
    const allowed = new Map<string, GmailSelectedSource>();

    for (const option of [...picker.clients, ...picker.contacts, ...picker.team]) {
      if (!option.email) continue;
      allowed.set(normalizeEmail(option.email), {
        kind: option.kind,
        sourceId: option.id,
        clientId: option.clientId,
        email: option.email,
        label: option.name,
      });
    }

    const wanted = parseGmailSources(String(formData.get("gmail_sources") ?? ""));
    const next: GmailSelectedSource[] = [];
    const seen = new Set<string>();

    for (const row of wanted) {
      const email = normalizeEmail(row.email ?? "");
      if (!looksLikeEmail(email) || seen.has(email)) continue;
      seen.add(email);

      if (row.kind === "external") {
        next.push({
          kind: "external",
          sourceId: null,
          clientId: null,
          email,
          label: row.label?.trim() || email,
        });
        continue;
      }

      const known = allowed.get(email);
      if (!known) continue;
      next.push(known);
    }

    const saved = await saveGmailSources(
      workspaceId,
      profile.user.id,
      next.map((row) => ({
        kind: row.kind,
        sourceId: row.sourceId,
        clientId: row.clientId,
        email: row.email,
        label: row.label,
      })),
    );
    if (!saved.ok) return saved;

    // Best effort: a mailbox that cannot be read should not fail the Save
    // of who may be read. The pill on Screen 16 will say Needs attention.
    await syncGmailContext(workspaceId);
  }

  // No revalidatePath: it remounts the page this dialog is on, and the dialog
  // with it, before anything can read what came back.
  return { ok: true, to: `${LIST}?saved=${encodeURIComponent(provider)}` };
}

/**
 * Screen 16.2's Disconnect.
 *
 * The row is kept and its status set rather than deleted, so what was connected
 * — and when it last worked — survives being turned off. §11.1.7 has a state
 * for exactly this, and a deleted row would read as "never connected".
 */
export async function disconnectIntegration(
  _previous: DialogResult,
  formData: FormData,
): Promise<DialogResult> {
  const stop = await readOnlyDialogResult();
  if (stop) return stop;

  const provider = String(formData.get("provider") ?? "").trim();
  if (!isProvider(provider)) {
    return { ok: false, error: "That integration is not one Whitby supports." };
  }

  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return { ok: false, error: "No workspace found." };

  // The grant goes first. If the row were marked disconnected and this then
  // failed, the screen would say one thing and the stored token another.
  if (provider === GOOGLE_PROVIDER) await revokeGoogleGrant(workspaceId);
  if (provider === GMAIL_PROVIDER) await revokeGmailGrant(workspaceId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("whitbyos_integrations")
    .update({ status: "disconnected", connected_account: null, error_state: null })
    .eq("workspace_id", workspaceId)
    .eq("provider", provider);

  if (error) return { ok: false, error: error.message };

  return { ok: true, to: `${LIST}?disconnected=${encodeURIComponent(provider)}` };
}
