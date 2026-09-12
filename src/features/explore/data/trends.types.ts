/** One trending tag. */
export interface Trend {
    tag: string;
    postCount: number;
    /**
     * How many articles carry it. Not drawn yet — this app has no article
     * screens until they land — but typed, because the field is in the schema
     * and the web's copy of this type leaves it out, which is how a client
     * ends up "discovering" a field the server has always sent.
     */
    articleCount: number;
    /**
     * **Nullable**, and the web's type says `string`.
     *
     * The schema is `Union([String, Null])`. The web gets away with it because
     * React renders a `null` child as nothing; React Native's `Text` does too,
     * but anything that reaches for `.length` or a `Map` lookup does not.
     */
    category: string | null;
}

/**
 * The trends endpoint wraps its list in an object — `data.trends`, not `data`.
 *
 * `apiClient` unwraps one envelope, so this is what arrives. `meta.windowDays`
 * sits outside it and is unreachable without `_envelope`; the copy names the
 * window instead, as the web's does.
 */
export interface TrendsData {
    trends: Trend[];
}

/** One tag from the search endpoint. Same shape, different key for the name. */
export interface TagSearchItem {
    name: string;
    postCount: number;
    articleCount: number;
    category: string | null;
}
