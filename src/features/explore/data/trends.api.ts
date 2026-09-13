import { api } from "@core/api/client";
import type { TagSearchItem, TrendsData } from "./trends.types";

/** The endpoint's ceiling on both routes. */
export const TAG_MAX_LIMIT = 50;

/** How many trends the grid draws. Two columns, so an even number. */
export const TRENDS_LIMIT = 20;

/** How many tags a search offers before the accounts below it. */
export const TAG_SEARCH_LIMIT = 10;

const clamp = (limit: number) => Math.min(Math.max(limit, 1), TAG_MAX_LIMIT);

export const trendsApi = {
    /**
     * What is being tagged lately.
     *
     * `isPublic`, like every read behind the sign-in wall: the flag governs
     * what a *stale* token does to a readable endpoint, which is a different
     * question from whether a guest may read it.
     */
    getTrends: (limit: number = TRENDS_LIMIT): Promise<TrendsData> =>
        api.get<TrendsData>(`/tags/trends?limit=${clamp(limit)}`, {
            isPublic: true,
        }),

    /**
     * Tags matching what somebody has typed.
     *
     * The query is encoded rather than interpolated: a tag search is the one
     * place in this app where a person's raw keystrokes become a URL, and `#`
     * would truncate it at the fragment.
     */
    searchTags: (
        q: string,
        limit: number = TAG_SEARCH_LIMIT,
    ): Promise<TagSearchItem[]> => {
        const query = new URLSearchParams({
            q,
            limit: String(clamp(limit)),
        });

        return api.get<TagSearchItem[]>(`/tags/search?${query.toString()}`, {
            isPublic: true,
        });
    },
};
