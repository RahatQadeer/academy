import "server-only";

import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea } from "@/academy/lib/authorization";
import { isAcademyCredentialStatus, isAcademyCredentialType } from "@/academy/credentials/utils/labels";
import { credentialTypeLabel } from "@/academy/credentials/utils/labels";
import { UUID } from "../../types";
import { CREDENTIAL_LIMIT } from "../types";
import type { AdminCredentialListItem, AdminCredentialsResult } from "../types";
import type { AdminCredentialFilters } from "../utils/filters";
import { credentialIsExpired } from "../utils/filters";

type ProgramEmbed = { id: string; name: string | null };
type CredentialRow = {
  id: string;
  user_id: string;
  program_id: string;
  type: string;
  status: string;
  awarded_at: string | null;
  expires_at: string | null;
  certificate_requested_at: string | null;
  academy_programs: ProgramEmbed | ProgramEmbed[] | null;
};
type IdentityRow = {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  email: string | null;
};
type AppliedEmbedRow = {
  credential_id: string;
  academy_credentials: CredentialRow | CredentialRow[] | null;
};

const CREDENTIAL_SELECT =
  "id, user_id, program_id, type, status, awarded_at, expires_at, certificate_requested_at, academy_programs ( id, name )";

function asProgram(value: CredentialRow["academy_programs"]): ProgramEmbed | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function displayName(row: IdentityRow | undefined, userId: string) {
  const name = (row?.preferred_name || row?.full_name || "").trim();
  if (name) return name;
  const email = row?.email?.trim();
  if (email) return email;
  return `Learner ${userId.slice(0, 8)}`;
}

export async function loadAdminCredentials(
  filters: AdminCredentialFilters = {
    view: "pending",
    type: "all",
    status: "all",
    search: "",
  },
): Promise<AdminCredentialsResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };
    // Admin area check already requires the admin role — one auth round-trip.
    if (!(await canAccessAdminArea({ id: profile.user.id }))) {
      return { ok: false, reason: "unauthorized" };
    }

    const supabase = await createClient();
    const needPending = filters.view === "pending" || filters.view === "all";
    const needAwarded =
      filters.view === "awarded" || filters.view === "all" || filters.view === "expired";
    const expiredOnly = filters.view === "expired";

    const reviewQuery = needPending
      ? (() => {
          let query = supabase
            .from("academy_credentials")
            .select(CREDENTIAL_SELECT)
            .eq("status", "credential_review")
            .order("certificate_requested_at", { ascending: false, nullsFirst: false })
            .limit(CREDENTIAL_LIMIT + 1);
          if (filters.type !== "all") query = query.eq("type", filters.type);
          return query;
        })()
      : null;

    const appliedQuery = needPending
      ? (() => {
          let query = supabase
            .from("academy_applied_work_submissions")
            .select(`credential_id, academy_credentials!inner ( ${CREDENTIAL_SELECT} )`)
            .in("status", ["submitted", "under_review"])
            .eq("academy_credentials.status", "applied_work")
            .limit(CREDENTIAL_LIMIT + 1);
          if (filters.type !== "all") {
            query = query.eq("academy_credentials.type", filters.type);
          }
          return query;
        })()
      : null;

    const awardedQuery = needAwarded
      ? (() => {
          let query = supabase
            .from("academy_credentials")
            .select(CREDENTIAL_SELECT)
            .eq("status", "awarded");
          if (filters.type !== "all") query = query.eq("type", filters.type);
          if (expiredOnly) {
            query = query
              .not("expires_at", "is", null)
              .lt("expires_at", new Date().toISOString())
              .order("expires_at", { ascending: false });
          } else {
            query = query.order("awarded_at", { ascending: false });
          }
          return query.limit(CREDENTIAL_LIMIT + 1);
        })()
      : null;

    const [reviewResult, appliedResult, awardedResult] = await Promise.all([
      reviewQuery ?? Promise.resolve({ data: null as CredentialRow[] | null, error: null }),
      appliedQuery ?? Promise.resolve({ data: null as AppliedEmbedRow[] | null, error: null }),
      awardedQuery ?? Promise.resolve({ data: null as CredentialRow[] | null, error: null }),
    ]);

    if (reviewResult.error || awardedResult.error) return { ok: false, reason: "failed" };
    // Applied-work join is optional enrichment — ignore its error so review still loads.

    const pendingById = new Map<string, CredentialRow>();
    for (const row of (reviewResult.data ?? []) as CredentialRow[]) {
      pendingById.set(row.id, row);
    }
    for (const row of (appliedResult.data ?? []) as AppliedEmbedRow[]) {
      const embedded = row.academy_credentials;
      const credential = Array.isArray(embedded) ? embedded[0] : embedded;
      if (credential?.id && !pendingById.has(credential.id)) {
        pendingById.set(credential.id, credential);
      }
    }

    const pendingAll = [...pendingById.values()].sort((a, b) => {
      const aReq = a.certificate_requested_at ?? "";
      const bReq = b.certificate_requested_at ?? "";
      if (aReq && !bReq) return -1;
      if (!aReq && bReq) return 1;
      return bReq.localeCompare(aReq);
    });
    const awardedAll = (awardedResult.data ?? []) as CredentialRow[];
    const pendingSlice = pendingAll.slice(0, CREDENTIAL_LIMIT);
    const awardedSlice = awardedAll.slice(0, CREDENTIAL_LIMIT);

    const rowsForNames =
      filters.view === "pending"
        ? pendingSlice
        : filters.view === "awarded" || filters.view === "expired"
          ? awardedSlice
          : [...pendingSlice, ...awardedSlice];

    const userIds = [...new Set(rowsForNames.map((row) => row.user_id))].filter((id) => UUID.test(id));
    const names = new Map<string, IdentityRow>();
    if (userIds.length > 0) {
      const { data: identityRows } = await supabase.rpc("academy_admin_user_identities", {
        p_user_ids: userIds,
      });
      for (const row of (identityRows ?? []) as IdentityRow[]) {
        names.set(row.id.toLowerCase(), row);
      }
    }

    function toItem(row: CredentialRow): AdminCredentialListItem | null {
      if (!UUID.test(row.id) || !isAcademyCredentialType(row.type) || !isAcademyCredentialStatus(row.status)) {
        return null;
      }
      const program = asProgram(row.academy_programs);
      return {
        id: row.id,
        learnerName: displayName(names.get(row.user_id.toLowerCase()), row.user_id),
        credentialName: program?.name?.trim() || credentialTypeLabel(row.type),
        type: row.type,
        status: row.status,
        awardedAt: row.awarded_at,
        expiresAt: row.expires_at,
        certificateRequestedAt: row.certificate_requested_at,
      };
    }

    function applyClientFilters(items: AdminCredentialListItem[]) {
      const search = filters.search.toLowerCase();
      return items.filter((item) => {
        if (filters.status !== "all" && item.status !== filters.status) return false;
        if (
          search &&
          !item.learnerName.toLowerCase().includes(search) &&
          !item.credentialName.toLowerCase().includes(search)
        ) {
          return false;
        }
        return true;
      });
    }

    const pendingItems = applyClientFilters(
      pendingSlice.map(toItem).filter((item): item is AdminCredentialListItem => Boolean(item)),
    );
    const awardedItems = applyClientFilters(
      awardedSlice.map(toItem).filter((item): item is AdminCredentialListItem => Boolean(item)),
    );

    const visible =
      filters.view === "awarded"
        ? awardedItems
        : filters.view === "expired"
          ? awardedItems.filter((item) => credentialIsExpired(item.expiresAt))
          : filters.view === "all"
            ? applyClientFilters(
                [...pendingSlice, ...awardedSlice]
                  .map(toItem)
                  .filter((item): item is AdminCredentialListItem => Boolean(item)),
              )
            : pendingItems;

    return {
      ok: true,
      data: {
        pending: pendingItems,
        awarded: awardedItems,
        visible,
        truncatedPending: needPending && pendingAll.length > CREDENTIAL_LIMIT,
        truncatedAwarded: needAwarded && awardedAll.length > CREDENTIAL_LIMIT,
      },
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
