import { createClient } from "@/base/lib/supabase/server";

/**
 * The shared Category taxonomy (SRS Section 10), read rather than hard-coded.
 *
 * Providers used to offer six words fixed in a dropdown — Financial Advisory,
 * Relocation Services, Household Staffing, Legal, Insurance, Other — while
 * twenty-five categories sat in `taxonomy_categories` doing nothing, and
 * `whitbyos_providers.category_id` sat empty beside them. The directory could
 * not be organised by a taxonomy it was not using.
 *
 * Base owns this table and admins are meant to be able to add, rename and
 * deactivate values without a deploy (§11.2.12), which is the other reason not
 * to keep a copy of the list in a component.
 */
export type CategoryOption = {
  id: string;
  slug: string;
  name: string;
  /** Legal, Medical, Financial and the rest carry this; it is base's word. */
  sensitive: boolean;
};

export async function listCategories(): Promise<CategoryOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("taxonomy_categories")
    .select("id, slug, name, default_sensitivity")
    .eq("active", true)
    .order("sort_order");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    sensitive: (row.default_sensitivity as string) !== "normal",
  }));
}

/** Name for an id, for the screens that print a category rather than pick one. */
export function categoryName(categories: CategoryOption[], id: string | null) {
  if (!id) return null;
  return categories.find((category) => category.id === id)?.name ?? null;
}

/**
 * The six words the old dropdown offered, against the taxonomy they meant.
 *
 * Three of them are already category names and match on their own. These are
 * the other three, so a provider filed before this change opens on the
 * category it was given rather than on whatever happens to sort first.
 */
const LEGACY: Record<string, string> = {
  "financial advisory": "financial-tax",
  "relocation services": "housing-relocation",
  other: "other-needs-review",
};

export function categoryBySlugOrName(
  categories: CategoryOption[],
  value: string | null,
) {
  if (!value) return null;
  const needle = value.trim().toLowerCase();
  const legacy = LEGACY[needle];
  return (
    categories.find((category) => category.id.toLowerCase() === needle) ??
    categories.find((category) => category.slug === needle) ??
    categories.find((category) => category.name.toLowerCase() === needle) ??
    (legacy ? categories.find((category) => category.slug === legacy) : undefined) ??
    null
  );
}
