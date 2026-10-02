export type SearchParams = Record<string, string | string[] | undefined>;

export type ScreenProps = {
  slug: string[];
  searchParams: SearchParams;
};

export function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export function flag(searchParams: SearchParams, key: string): boolean {
  return param(searchParams, key) !== undefined;
}

/** Reads `?tab=`, falling back to the default when absent or unrecognised. */
export function tabParam<T extends string>(
  searchParams: SearchParams,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = param(searchParams, "tab");
  return allowed.includes(value as T) ? (value as T) : fallback;
}
