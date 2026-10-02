"use server";

import { search, type SearchHit } from "@/whitbyos/lib/search";

/**
 * 1.0a's search, callable from the header on any screen.
 *
 * It used to live in Home's URL (`?search=1&q=…`), which meant the box only
 * worked on Home and pressing the magnifier anywhere else would have had to
 * leave the screen first. The header owns it now, so the query stays in the
 * component and the results come back from here.
 */
export async function searchWorkspace(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return search(trimmed);
}
