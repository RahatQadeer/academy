import { partnerFacingError } from "@/partner-center/lib/user-facing-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseApplicationData } from "@/partner-center/lib/application-map";
import type {
  PartnerProgramFamily,
} from "@/partner-center/types/application";

const PROGRAM_FAMILIES = new Set<PartnerProgramFamily>([
  "academy",
  "platform",
  "enterprise",
]);

function asProgramFamily(value: unknown): PartnerProgramFamily | null {
  if (typeof value !== "string") return null;
  return PROGRAM_FAMILIES.has(value as PartnerProgramFamily)
    ? (value as PartnerProgramFamily)
    : null;
}

function uniquePrograms(programs: PartnerProgramFamily[]): PartnerProgramFamily[] {
  return [...new Set(programs)];
}

/**
 * Insert missing partner_programs rows and mark the given families active
 * (SRS §17.13.3 / §17.13.5).
 */
export async function enablePartnerPrograms(
  admin: SupabaseClient,
  partnerProfileId: string,
  programs: PartnerProgramFamily[],
): Promise<{ error?: string }> {
  const selected = uniquePrograms(programs.filter(Boolean));
  if (selected.length === 0) {
    return { error: "Select at least one program." };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing, error: loadError } = await admin
    .from("partner_programs")
    .select("program")
    .eq("partner_profile_id", partnerProfileId);
  if (loadError) return { error: partnerFacingError("Could not update your programs.", loadError.message) };

  const existingPrograms = new Set(
    (existing ?? []).map((row) => row.program as string),
  );

  const toInsert = selected
    .filter((program) => !existingPrograms.has(program))
    .map((program) => ({
      partner_profile_id: partnerProfileId,
      program,
      active: true,
      effective_start: today,
      effective_end: null,
    }));

  if (toInsert.length > 0) {
    const { error } = await admin.from("partner_programs").insert(toInsert);
    if (error) return { error: partnerFacingError("Could not update your programs.", error.message) };
  }

  const { error: activateError } = await admin
    .from("partner_programs")
    .update({ active: true, effective_start: today })
    .eq("partner_profile_id", partnerProfileId)
    .in("program", selected);

  if (activateError) return { error: partnerFacingError("Could not update your programs.", activateError.message) };
  return {};
}

async function loadProgramRows(
  admin: SupabaseClient,
  partnerProfileId: string,
): Promise<
  | { error: string }
  | { rows: { id: string; program: string; active: boolean }[] }
> {
  const { data, error } = await admin
    .from("partner_programs")
    .select("id, program, active")
    .eq("partner_profile_id", partnerProfileId);
  if (error) return { error: partnerFacingError("Could not update your programs.", error.message) };
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id as string,
      program: row.program as string,
      active: Boolean(row.active),
    })),
  };
}

/**
 * partner_programs has no unique(partner_profile_id, program). Parallel
 * ensure/heal calls can insert duplicates — collapse to one row per family.
 */
async function dedupeProgramRows(
  admin: SupabaseClient,
  rows: { id: string; program: string; active: boolean }[],
): Promise<{ error?: string; rows: { id: string; program: string; active: boolean }[] }> {
  const byProgram = new Map<string, { id: string; program: string; active: boolean }[]>();
  for (const row of rows) {
    const key = row.program;
    const list = byProgram.get(key) ?? [];
    list.push(row);
    byProgram.set(key, list);
  }

  const keep: { id: string; program: string; active: boolean }[] = [];
  const deleteIds: string[] = [];

  for (const list of byProgram.values()) {
    const preferred =
      list.find((row) => row.active) ?? list[0]!;
    keep.push(preferred);
    for (const row of list) {
      if (row.id !== preferred.id) deleteIds.push(row.id);
    }
  }

  if (deleteIds.length > 0) {
    const { error } = await admin
      .from("partner_programs")
      .delete()
      .in("id", deleteIds);
    if (error) return { error: partnerFacingError("Could not update your programs.", error.message), rows: keep };
  }

  return { rows: keep };
}

async function inferProgramsFromActivity(
  admin: SupabaseClient,
  partnerProfileId: string,
): Promise<PartnerProgramFamily[]> {
  const [{ data: referrals }, { data: opportunities }] = await Promise.all([
    admin
      .from("partner_referrals")
      .select("program")
      .eq("partner_profile_id", partnerProfileId),
    admin
      .from("partner_opportunities")
      .select("id")
      .eq("partner_profile_id", partnerProfileId)
      .limit(1),
  ]);

  const found: PartnerProgramFamily[] = [];
  for (const row of referrals ?? []) {
    const program = asProgramFamily(row.program);
    if (program && program !== "enterprise") found.push(program);
  }
  if ((opportunities ?? []).length > 0) {
    found.push("enterprise");
  }
  return uniquePrograms(found);
}

/**
 * Ensures an Active (or about-to-be-Active) partner has ≥1 active program row.
 * Resolution order: already active (+ heal missing from activity) → reactivate
 * existing → products_of_interest → infer from referrals/opportunities → error.
 */
export async function ensureActivePartnerPrograms(
  admin: SupabaseClient,
  partnerProfileId: string,
  applicationData?: unknown,
): Promise<{ error?: string; enabled?: PartnerProgramFamily[] }> {
  const loaded = await loadProgramRows(admin, partnerProfileId);
  if ("error" in loaded) return { error: loaded.error };

  const deduped = await dedupeProgramRows(admin, loaded.rows);
  if (deduped.error) return { error: deduped.error };
  const rows = deduped.rows;

  const active = rows
    .filter((row) => row.active)
    .map((row) => asProgramFamily(row.program))
    .filter((p): p is PartnerProgramFamily => Boolean(p));
  if (active.length > 0) {
    const enabled = uniquePrograms(active);
    const inferred = await inferProgramsFromActivity(admin, partnerProfileId);
    const missing = inferred.filter((program) => !enabled.includes(program));
    if (missing.length > 0) {
      const result = await enablePartnerPrograms(
        admin,
        partnerProfileId,
        missing,
      );
      if (result.error) return result;
      return { enabled: uniquePrograms([...enabled, ...missing]) };
    }
    return { enabled };
  }

  const inactive = rows
    .map((row) => asProgramFamily(row.program))
    .filter((p): p is PartnerProgramFamily => Boolean(p));
  if (inactive.length > 0) {
    const selected = uniquePrograms(inactive);
    const result = await enablePartnerPrograms(admin, partnerProfileId, selected);
    if (result.error) return result;
    return { enabled: selected };
  }

  const application = parseApplicationData(applicationData);

  if (application.products_of_interest.length > 0) {
    const selected = uniquePrograms(application.products_of_interest);
    const result = await enablePartnerPrograms(admin, partnerProfileId, selected);
    if (result.error) return result;
    return { enabled: selected };
  }

  const inferred = await inferProgramsFromActivity(admin, partnerProfileId);
  if (inferred.length > 0) {
    const result = await enablePartnerPrograms(admin, partnerProfileId, inferred);
    if (result.error) return result;
    return { enabled: inferred };
  }

  return {
    error:
      "No partner programs are assigned. Ask your Private Attaché contact to assign programs before activating.",
  };
}

/** True when a specific program family is active for the partner. */
export async function isPartnerProgramActive(
  client: SupabaseClient,
  partnerProfileId: string,
  program: PartnerProgramFamily,
): Promise<boolean> {
  const { data, error } = await client
    .from("partner_programs")
    .select("id")
    .eq("partner_profile_id", partnerProfileId)
    .eq("program", program)
    .eq("active", true)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

/** True when the partner has at least one active partner_programs row. */
export async function partnerHasActivePrograms(
  client: SupabaseClient,
  partnerProfileId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("partner_programs")
    .select("id")
    .eq("partner_profile_id", partnerProfileId)
    .eq("active", true)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}
