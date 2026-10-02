import type { ResourceSort, ResourcesQuery } from "../types";

export function parseResourcesProgramId(
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const value = searchParams.programId;
  const raw = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return raw.trim() || null;
}

export function parseResourcesQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ResourcesQuery {
  const first = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const sort = first("sort");
  return {
    programId: parseResourcesProgramId(searchParams),
    search: first("q").trim(),
    type: first("type").trim(),
    sort: sort === "type" || sort === "lesson" ? sort : "title",
  };
}

export function resourcesHref(query: Partial<ResourcesQuery> = {}) {
  const params = new URLSearchParams();
  if (query.programId) params.set("programId", query.programId);
  if (query.search?.trim()) params.set("q", query.search.trim());
  if (query.type?.trim()) params.set("type", query.type.trim());
  if (query.sort && query.sort !== "title") params.set("sort", query.sort);
  const encoded = params.toString();
  return encoded ? `/academy/resources?${encoded}` : "/academy/resources";
}
