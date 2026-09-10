/**
 * Where the web app is served from, which is **not** where the API is.
 *
 * A shared link has to open something a person can read, so it points at the
 * site rather than at `api.developernetwork.net`. Overridable for the same
 * reason `EXPO_PUBLIC_API_URL` is: a staging build should not hand out links
 * into production.
 */
export const WEB_URL =
    process.env.EXPO_PUBLIC_WEB_URL ?? "https://developernetwork.net";

/**
 * The address of a post on the web.
 *
 * The route is the web client's own — `/post/:id` — and it is written here
 * rather than derived, because nothing on this side of the wire knows it. If
 * the site ever renames that route, every link shared from a phone before the
 * rename is already out in the world; this is the one place to change.
 *
 * @param postId - The post's id
 * @returns An absolute URL
 */
export function postUrl(postId: string): string {
    return buildPostUrl(WEB_URL, postId);
}

/**
 * The same, against a given origin — which is what makes the trailing-slash
 * handling testable. `EXPO_PUBLIC_WEB_URL` is typed into an env file by a
 * person, and "https://example.test/" is what a person types.
 *
 * @param origin - Where the site is served from
 * @param postId - The post's id
 * @returns An absolute URL with exactly one separator
 */
export function buildPostUrl(origin: string, postId: string): string {
    return `${origin.replace(/\/+$/, "")}/post/${postId}`;
}
