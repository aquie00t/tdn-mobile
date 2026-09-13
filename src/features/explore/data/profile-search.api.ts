import { api } from "@core/api/client";
import type { ProfileSearchItem } from "./profile-search.types";

/** The endpoint's ceiling. */
export const PROFILE_SEARCH_MAX_LIMIT = 50;

/** How many accounts a search offers above the tags. */
export const PROFILE_SEARCH_LIMIT = 8;

/**
 * The shortest query the endpoint accepts.
 *
 * Two characters, enforced server-side: a shorter `q` is a 400, not an empty
 * list. The search screen holds its own floor at the same number for exactly
 * this reason — one keystroke below it would be a request that can only fail.
 */
export const PROFILE_SEARCH_MIN_CHARS = 2;

/**
 * Accounts by handle or name.
 *
 * Lives in this feature rather than in the profile feature, which is where the
 * web keeps it: the web searches profiles from a dropdown in its header, and a
 * phone has no header to put one in. Search on this app is the explore screen,
 * so the endpoint belongs to the screen that calls it — and nothing else does.
 * Two features needing it is what would move it to `shared/`, as the follow
 * pair moved.
 */
export const profileSearchApi = {
    searchProfiles: (
        q: string,
        limit: number = PROFILE_SEARCH_LIMIT,
    ): Promise<ProfileSearchItem[]> => {
        const query = new URLSearchParams({
            q,
            limit: String(
                Math.min(Math.max(limit, 1), PROFILE_SEARCH_MAX_LIMIT),
            ),
        });

        return api.get<ProfileSearchItem[]>(
            `/profiles/search?${query.toString()}`,
            { isPublic: true },
        );
    },
};
