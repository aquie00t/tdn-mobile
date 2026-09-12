import type { SearchResults } from "./useSearchResults";
import type { TagSearchItem } from "../../data/trends.types";
import { trendsApi } from "../../data/trends.api";
import { useSearchResults } from "./useSearchResults";

/**
 * Two characters, which is the endpoint's floor for *accounts* rather than
 * for tags — `/tags/search` accepts one.
 *
 * Held at the same number anyway, because one box drives both searches here:
 * a single floor means a keystroke either asks both endpoints or neither,
 * where two floors would send a request that can only come back a 400
 * alongside one that works.
 */
export const SEARCH_MIN_CHARS = 2;

/** Module scope, so the hook below is not handed a new function per render. */
const searchTags = (q: string) => trendsApi.searchTags(q);

export function useTagSearch(query: string): SearchResults<TagSearchItem> {
    return useSearchResults(query, searchTags, SEARCH_MIN_CHARS);
}
