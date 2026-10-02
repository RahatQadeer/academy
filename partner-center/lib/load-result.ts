export type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; data?: never };

export type PartialLoadResult<T, W extends string = string> =
  | { ok: true; data: T; warnings?: W[] }
  | { ok: false; error: string; data?: T; warnings?: W[] };
