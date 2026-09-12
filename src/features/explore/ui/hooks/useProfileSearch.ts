import { profileSearchApi } from "../../data/profile-search.api";
import type { ProfileSearchItem } from "../../data/profile-search.types";
import type { SearchResults } from "./useSearchResults";
import { SEARCH_MIN_CHARS } from "./useTagSearch";
import { useSearchResults } from "./useSearchResults";

const searchProfiles = (q: string) => profileSearchApi.searchProfiles(q);

/**
 * Accounts matching what is in the box.
 *
 * The web runs this from a dropdown in its header; a phone has no header, so
 * the explore screen is where it lives and the same query drives it and the
 * tag search together.
 */
export function useProfileSearch(
    query: string,
): SearchResults<ProfileSearchItem> {
    return useSearchResults(query, searchProfiles, SEARCH_MIN_CHARS);
}
