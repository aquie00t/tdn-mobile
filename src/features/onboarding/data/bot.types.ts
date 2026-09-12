import type { CategoryValue } from "@shared/constants/categories";

/**
 * One suggested account: a news bot from `GET /profiles/bots`.
 *
 * The endpoint also sends `bannerUrl` and `isVerified`, and neither is read
 * here — a banner has no place on a row this size, and a verification badge is
 * a piece of design this app has not settled yet. They are left out of the
 * type rather than carried unused, so nothing renders them by accident.
 */
export interface BotProfile {
    userId: string;
    username: string;
    fullName: string;
    avatarUrl: string;
    /**
     * Nullable, and the web's copy of this type says `string`.
     *
     * The schema is `Union([String, Null])`, so the web is wrong and gets away
     * with it by only ever rendering it behind a truthiness check. Typed
     * honestly here: a `null` reaching `.length` is a crash, and bots are
     * exactly the accounts most likely to have no bio.
     */
    bio: string | null;
    /** Never empty: the endpoint only returns bots that carry a category. */
    categories: CategoryValue[];
    followersCount: number;
    /**
     * Whether the reader already followed this bot when the list was fetched.
     *
     * Load-bearing for a *returning* account: somebody who followed three bots
     * and left before finishing has to come back to those three already
     * marked, or the flow asks them to follow accounts they have followed
     * once already — and the count would then be wrong in both directions.
     */
    isFollowing: boolean;
}

export interface BotListParams {
    /**
     * Omitted entirely when empty, which is not the same request: no
     * `categories` means every categorised bot, and the flow relies on that
     * for a reader who reaches step two without a field.
     */
    categories?: CategoryValue[];
    limit?: number;
    offset?: number;
}
