/** The extensions the API accepts for video. Everything else is an image. */
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov)$/i;

/**
 * Schemes a media URI may use.
 *
 * Narrower than the web's, which also allows `blob:` for the previews
 * `URL.createObjectURL` makes — there is no such thing here. `file:` is
 * deliberately absent: nothing in a feed should be able to put a path off this
 * device's own disk into a view.
 */
const SAFE_SCHEMES = /^https?:\/\//i;

/**
 * Whether this attachment is a video.
 *
 * Decided by extension, as the web decides it. The API does not label
 * attachments by kind, and the URLs it returns are its own — a query string
 * appended by a CDN is stripped before the test so `clip.mp4?token=…` is still
 * a video.
 *
 * @param uri - The attachment URL
 * @returns Whether to render it as a video
 */
export function isVideoUri(uri: string): boolean {
    const withoutQuery = uri.split(/[?#]/)[0];
    return VIDEO_EXTENSIONS.test(withoutQuery);
}

/**
 * A media URI, or `null` when it is missing or uses a scheme we do not trust.
 *
 * Defence in depth rather than a filter on anything expected: these URLs come
 * from our own API. The web's version of this exists because a `javascript:`
 * URL in an `<img src>` runs, which has no equivalent in React Native — but
 * `file:` does have one, and a component that renders whatever string it is
 * handed is a component that will one day be handed a path.
 *
 * The check is a scheme test rather than a `new URL()` round trip, because
 * React Native's `URL` is a partial polyfill: it parses enough to look right
 * in a test under Node and differently on a phone.
 *
 * @param uri - The attachment URL, or nothing
 * @returns The URI when it is safe to render, `null` otherwise
 */
export function getSafeMediaUri(uri: string | null | undefined): string | null {
    if (!uri) return null;
    return SAFE_SCHEMES.test(uri.trim()) ? uri.trim() : null;
}
