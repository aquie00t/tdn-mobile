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
 * Shared rather than owned by a feature, which is the rule this codebase
 * applies the moment a second caller appears. It began in the explore feature,
 * where it is the account half of the search screen; mentions then needed the
 * same endpoint to complete an `@handle`, and a feature may not import another
 * feature. The web has no such pair — it searches profiles from a dropdown in
 * its header, which a phone has nowhere to put.
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
