/**
 * The narrowings, as plain strings.
 *
 * `domain/` may not import `data/` — the rule is checked rather than agreed —
 * and this does not need to: an identity does not care what the values mean,
 * only whether they changed. The caller passes its own `PostType` and
 * `PostCategory`, which are strings.
 */
export interface FeedFilters {
    type: string;
    followedOnly: boolean;
    categories: readonly string[];
}

/**
 * What makes one feed a different feed from another.
 *
 * The screen re-reads whenever this string changes, which is the web's
 * `feedIdentity` by another name. Two things it has to get right:
 *
 * The categories are **sorted** before they are joined, so choosing Frontend
 * then Backend produces the same identity as choosing Backend then Frontend.
 * They do — the API matches a post against *any* of them — and without the
 * sort the reader pays for a round trip to arrive at the list already on
 * screen.
 *
 * `followedOnly` is in it because it changes the request rather than filtering
 * what came back: the endpoint answers a different set, and it also decides
 * whether the request is public at all.
 *
 * @param filters - What the reader has narrowed the feed to
 * @returns A key that changes exactly when the answer would
 */
export function feedIdentity({
    type,
    followedOnly,
    categories,
}: FeedFilters): string {
    // The spread copies first, so the caller's array is never reordered — the
    // rule below flags `sort` on sight and cannot see that.
    // eslint-disable-next-line unicorn/no-array-sort
    const sorted = [...categories].sort().join(",");
    return `${type}|${followedOnly ? "1" : "0"}|${sorted}`;
}
