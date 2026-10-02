import type { PartnerTeamFunction } from "@/partner-center/types/partner";
import type { PartnerAccessLevel } from "@/partner-center/team/types";
import {
  ACCESS_LEVELS,
  PREFERRED_CONTACT_METHODS,
  TEAM_FUNCTIONS,
  type PreferredContactMethod,
} from "@/partner-center/team/lib/labels";

export type PartnerTeamInvitePayload = {
  function: PartnerTeamFunction;
  access_level: PartnerAccessLevel;
  title_role: string;
  salutation: string;
  phone: string;
  preferred_contact_method: PreferredContactMethod | "";
};

const FUNCTION_SET = new Set(TEAM_FUNCTIONS.map((item) => item.value));
const ACCESS_SET = new Set(ACCESS_LEVELS.map((item) => item.value));
const METHOD_SET = new Set(PREFERRED_CONTACT_METHODS.map((item) => item.value));

function asMethod(value: unknown): PreferredContactMethod | "" {
  if (typeof value !== "string" || !value.trim()) return "";
  return METHOD_SET.has(value as PreferredContactMethod)
    ? (value as PreferredContactMethod)
    : "";
}

export function encodePartnerTeamInvite(payload: PartnerTeamInvitePayload): string {
  return JSON.stringify({
    function: payload.function,
    access_level: payload.access_level,
    title_role: payload.title_role.trim(),
    salutation: payload.salutation.trim(),
    phone: payload.phone.trim(),
    preferred_contact_method: payload.preferred_contact_method || "",
  });
}

export function decodePartnerTeamInvite(
  raw: string | null | undefined,
): PartnerTeamInvitePayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const fn = typeof parsed.function === "string" ? parsed.function : "";
    const access =
      typeof parsed.access_level === "string" ? parsed.access_level : "";
    const title =
      typeof parsed.title_role === "string" ? parsed.title_role.trim() : "";
    const salutation =
      typeof parsed.salutation === "string" ? parsed.salutation.trim() : "";
    const phone = typeof parsed.phone === "string" ? parsed.phone.trim() : "";
    if (!FUNCTION_SET.has(fn as PartnerTeamFunction)) return null;
    if (!ACCESS_SET.has(access as PartnerAccessLevel)) return null;
    return {
      function: fn as PartnerTeamFunction,
      access_level: access as PartnerAccessLevel,
      title_role: title,
      salutation,
      phone,
      preferred_contact_method: asMethod(parsed.preferred_contact_method),
    };
  } catch {
    return null;
  }
}
