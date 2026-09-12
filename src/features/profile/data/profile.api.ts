import { api } from "@core/api/client";
import type { FollowListParams, FollowUser, Profile } from "./profile.types";

/**
 * Both follow endpoints take `limit` (default 20, max 50) and `offset`
 * (default 0). Omitting them does not mean "everything" — it means the
 * server's first twenty, which is how these lists came to stop at twenty on
 * the web with nothing on screen saying so.
 *
 * `limit` is clamped rather than sent: the schema answers an over-large value
 * with a 400, and a list that renders an error instead of people is worse than
 * a shorter page.
 */
export const FOLLOW_LIST_MAX_LIMIT = 50;
export const FOLLOW_LIST_PAGE_SIZE = 20;

function followListQuery({
    limit = FOLLOW_LIST_PAGE_SIZE,
    offset = 0,
}: FollowListParams): string {
    const query = new URLSearchParams();
    query.set("limit", String(Math.min(limit, FOLLOW_LIST_MAX_LIMIT)));
    query.set("offset", String(offset));
    return query.toString();
}

export const profileApi = {
    /**
     * `isPublic` on all three reads, for the reason the feed uses it: a stale
     * token on a readable endpoint should show the profile rather than an
     * empty screen.
     *
     * A user's *posts* are not here. `/users/:username/posts` answers posts,
     * and the type and the card that render them belong to the feed — a
     * feature may not reach into another, so that read lives with the rest of
     * the post reads and the profile screen composes the two in its route.
     */
    getProfile: (username: string): Promise<Profile> =>
        api.get<Profile>(`/profiles/${username}`, { isPublic: true }),

    getFollowers: (
        username: string,
        params: FollowListParams = {},
    ): Promise<FollowUser[]> =>
        api.get<FollowUser[]>(
            `/profiles/${username}/followers?${followListQuery(params)}`,
            { isPublic: true },
        ),

    getFollowing: (
        username: string,
        params: FollowListParams = {},
    ): Promise<FollowUser[]> =>
        api.get<FollowUser[]>(
            `/profiles/${username}/following?${followListQuery(params)}`,
            { isPublic: true },
        ),
};
