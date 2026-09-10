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
    return buildWebUrl(WEB_URL, `/post/${postId}`);
}

/**
 * The address of a comment on the web. Its route is plural where a post's is
 * singular, which is the site's own inconsistency and not one to fix from
 * here — a link has to match what is actually served.
 *
 * @param commentId - The comment's id
 * @returns An absolute URL
 */
export function commentUrl(commentId: string): string {
    return buildWebUrl(WEB_URL, `/comments/${commentId}`);
}

/**
 * Joins an origin and a path — which is what makes the trailing-slash handling
 * testable. `EXPO_PUBLIC_WEB_URL` is typed into an env file by a person, and
 * "https://example.test/" is what a person types.
 *
 * @param origin - Where the site is served from
 * @param path - An absolute path, leading slash included
 * @returns An absolute URL with exactly one separator
 */
export function buildWebUrl(origin: string, path: string): string {
    return `${origin.replace(/\/+$/, "")}${path}`;
}
