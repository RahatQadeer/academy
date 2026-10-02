export type SearchParams = Record<string, string | string[] | undefined>;

/** A repeated query param arrives as an array; list screens only want one value. */
export function param(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  const single = Array.isArray(value) ? value[0] : value;
  return single?.trim() || undefined;
}
