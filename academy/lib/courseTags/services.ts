import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/base/lib/supabase/server";
import { getSessionProfile } from "@/base/identity/session";
import { canAccessAdminArea, isAcademyAdmin } from "@/academy/lib/authorization";
import {
  ACADEMY_SETTINGS_COOKIE,
  parseAcademySettings,
} from "@/academy/admin/settings/lib/defaults";
import type { AcademyAdminSettings } from "@/academy/admin/settings/types";
import {
  PREMADE_COURSE_TAG_NAMES,
  encodeProgramCategory,
  normalizeCourseTagName,
  parseProgramCategory,
  premadeTagId,
  slugifyCourseTag,
  validateProgramTagIds,
} from "./constants";
import type { CourseTag, CourseTagListResult, CourseTagMutationResult } from "./types";

const PREMADE_SET = new Set<string>(PREMADE_COURSE_TAG_NAMES);

function tagFromName(name: string, isPremade: boolean, archivedAt: string | null = null): CourseTag {
  const normalized = normalizeCourseTagName(name);
  const slug = slugifyCourseTag(normalized);
  return {
    id: slug,
    name: normalized,
    slug,
    isPremade,
    archivedAt,
  };
}

async function requireAdmin() {
  const profile = await getSessionProfile();
  if (!profile) return null;
  const actor = { id: profile.user.id };
  const [area, admin] = await Promise.all([canAccessAdminArea(actor), isAcademyAdmin(actor)]);
  if (!area || !admin) return null;
  return profile;
}

async function readSettings(): Promise<AcademyAdminSettings> {
  const store = await cookies();
  return parseAcademySettings(store.get(ACADEMY_SETTINGS_COOKIE)?.value);
}

async function writeSettings(settings: AcademyAdminSettings) {
  const store = await cookies();
  // Defense in depth: tag mutations must never rewrite Super-Admin-only keys.
  const previous = parseAcademySettings(store.get(ACADEMY_SETTINGS_COOKIE)?.value);
  const next = {
    ...settings,
    identityProvider: previous.identityProvider,
  };
  store.set(ACADEMY_SETTINGS_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

function bankFromSettings(settings: AcademyAdminSettings): CourseTag[] {
  const archived = new Set(settings.archivedPremadeTagIds ?? []);
  const premade = PREMADE_COURSE_TAG_NAMES.map((name) =>
    tagFromName(name, true, archived.has(premadeTagId(name)) ? new Date(0).toISOString() : null),
  );
  const custom = (settings.customCourseTags ?? []).map((name) => tagFromName(name, false));
  return [...premade, ...custom];
}

/** All tag names currently stored on programs via category. */
async function loadCategoryNameUsage(): Promise<{ counts: Map<string, number>; namesById: Map<string, string> }> {
  const supabase = await createClient();
  const { data } = await supabase.from("academy_programs").select("category");
  const counts = new Map<string, number>();
  const namesById = new Map<string, string>();
  for (const row of (data ?? []) as { category?: string | null }[]) {
    for (const name of parseProgramCategory(row.category)) {
      const id = slugifyCourseTag(name);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (!namesById.has(id)) namesById.set(id, name);
    }
  }
  return { counts, namesById };
}

export async function loadCourseTags(options?: {
  includeArchived?: boolean;
  withCounts?: boolean;
}): Promise<CourseTagListResult> {
  try {
    const profile = await getSessionProfile();
    if (!profile) return { ok: false, reason: "unauthorized" };

    const settings = await readSettings();
    let counts = new Map<string, number>();
    let namesById = new Map<string, string>();
    try {
      const usage = await loadCategoryNameUsage();
      counts = usage.counts;
      namesById = usage.namesById;
    } catch {
      /* Premade bank still works without usage counts. */
    }

    const byId = new Map<string, CourseTag>();

    for (const tag of bankFromSettings(settings)) {
      byId.set(tag.id, tag);
    }
    for (const [id, name] of namesById) {
      if (!byId.has(id)) {
        byId.set(id, tagFromName(name, PREMADE_SET.has(name)));
      }
    }

    let tags = [...byId.values()];
    if (!options?.includeArchived) {
      tags = tags.filter((tag) => !tag.archivedAt);
    }

    tags.sort((a, b) => {
      if (a.isPremade !== b.isPremade) return a.isPremade ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return {
      ok: true,
      tags: tags.map((tag) => ({
        ...tag,
        ...(options?.withCounts ? { programCount: counts.get(tag.id) ?? 0 } : null),
      })),
    };
  } catch {
    // Last resort: still return premade so create forms are usable.
    return {
      ok: true,
      tags: PREMADE_COURSE_TAG_NAMES.map((name) => tagFromName(name, true)),
    };
  }
}

export async function createCourseTag(nameInput: string): Promise<CourseTagMutationResult> {
  try {
    const profile = await requireAdmin();
    if (!profile) return { ok: false, reason: "unauthorized", message: "Admin access required." };

    const name = normalizeCourseTagName(nameInput);
    if (!name) return { ok: false, reason: "invalid", message: "Enter a tag name." };
    const slug = slugifyCourseTag(name);
    if (!slug) return { ok: false, reason: "invalid", message: "Enter a valid tag name." };

    const settings = await readSettings();
    const bank = bankFromSettings(settings).filter((tag) => !tag.archivedAt);
    if (bank.some((tag) => tag.id === slug || tag.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, reason: "conflict", message: "That tag already exists." };
    }

    await writeSettings({
      ...settings,
      customCourseTags: [...(settings.customCourseTags ?? []), name],
    });
    return { ok: true, tag: tagFromName(name, false) };
  } catch {
    return { ok: false, reason: "failed", message: "Could not create the tag." };
  }
}

export async function archiveCourseTag(tagId: string): Promise<CourseTagMutationResult> {
  try {
    const profile = await requireAdmin();
    if (!profile) return { ok: false, reason: "unauthorized", message: "Admin access required." };
    if (!tagId.trim()) return { ok: false, reason: "invalid", message: "Missing tag." };

    const settings = await readSettings();
    const bank = bankFromSettings(settings);
    const existing = bank.find((tag) => tag.id === tagId);
    if (!existing) return { ok: false, reason: "invalid", message: "Tag not found." };

    if (existing.isPremade) {
      const archived = new Set(settings.archivedPremadeTagIds ?? []);
      archived.add(existing.id);
      await writeSettings({
        ...settings,
        archivedPremadeTagIds: [...archived],
      });
      return { ok: true, tag: { ...existing, archivedAt: new Date().toISOString() } };
    }

    await writeSettings({
      ...settings,
      customCourseTags: (settings.customCourseTags ?? []).filter(
        (name) => slugifyCourseTag(name) !== tagId,
      ),
    });
    return { ok: true, tag: { ...existing, archivedAt: new Date().toISOString() } };
  } catch {
    return { ok: false, reason: "failed", message: "Could not remove the tag." };
  }
}

export async function restoreCourseTag(tagId: string): Promise<CourseTagMutationResult> {
  try {
    const profile = await requireAdmin();
    if (!profile) return { ok: false, reason: "unauthorized", message: "Admin access required." };
    if (!tagId.trim()) return { ok: false, reason: "invalid", message: "Missing tag." };

    const settings = await readSettings();
    const bank = bankFromSettings(settings);
    const existing = bank.find((tag) => tag.id === tagId);
    if (!existing) return { ok: false, reason: "invalid", message: "Tag not found." };
    if (!existing.isPremade) {
      return { ok: false, reason: "invalid", message: "Only built-in tags can be restored this way." };
    }

    await writeSettings({
      ...settings,
      archivedPremadeTagIds: (settings.archivedPremadeTagIds ?? []).filter((id) => id !== tagId),
    });
    return { ok: true, tag: { ...existing, archivedAt: null } };
  } catch {
    return { ok: false, reason: "failed", message: "Could not restore the tag." };
  }
}

export async function loadProgramTagIds(programId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_programs")
    .select("category")
    .eq("id", programId)
    .maybeSingle();
  return parseProgramCategory((data as { category?: string | null } | null)?.category).map((name) =>
    slugifyCourseTag(name),
  );
}

export async function loadProgramTags(programId: string): Promise<CourseTag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("academy_programs")
    .select("category")
    .eq("id", programId)
    .maybeSingle();
  const names = parseProgramCategory((data as { category?: string | null } | null)?.category);
  const settings = await readSettings();
  const byId = new Map(bankFromSettings(settings).map((tag) => [tag.id, tag]));
  return names.map((name) => {
    const id = slugifyCourseTag(name);
    return byId.get(id) ?? tagFromName(name, PREMADE_SET.has(name));
  });
}

/** Write exactly COURSE_TAG_MIN–COURSE_TAG_MAX tags into existing academy_programs.category. */
export async function setProgramTags(
  programId: string,
  tagIds: string[],
): Promise<{ ok: true; category: string } | { ok: false; message: string }> {
  const validation = validateProgramTagIds(tagIds);
  if (validation) return { ok: false, message: validation };

  const unique = [...new Set(tagIds.map((id) => id.trim()).filter(Boolean))];
  const settings = await readSettings();
  const { namesById } = await loadCategoryNameUsage();
  const byId = new Map<string, CourseTag>();
  for (const tag of bankFromSettings(settings)) {
    if (!tag.archivedAt) byId.set(tag.id, tag);
  }
  for (const [id, name] of namesById) {
    if (!byId.has(id)) byId.set(id, tagFromName(name, PREMADE_SET.has(name)));
  }

  const names: string[] = [];
  for (const id of unique) {
    const tag = byId.get(id);
    if (!tag) return { ok: false, message: "One or more tags are unavailable." };
    names.push(tag.name);
  }

  const category = encodeProgramCategory(names);
  const supabase = await createClient();
  const { error } = await supabase.from("academy_programs").update({ category }).eq("id", programId);
  if (error) return { ok: false, message: "Could not update program tags." };
  return { ok: true, category };
}
