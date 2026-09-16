import { api } from "@core/api/client";
import { buildMediaForm } from "./asset-to-form";
import type { PickedAsset } from "./asset-to-form";
import { withModerationRetry } from "./media-errors";

/** Both upload endpoints refuse a fifth file, so nothing offers one. */
export const MAX_MEDIA_FILES = 4;

/**
 * The two upload channels.
 *
 * **The channel is fixed when the bytes arrive**, not by what is attached to
 * afterwards: a file uploaded to `/media` cannot be attached to a message and
 * one uploaded to `/messages/media` cannot be attached to a post. Crossing
 * them is `400 MediaNotOwnedError`, which is a confusing thing to debug from
 * the far end, so the endpoint is named at the call site rather than defaulted
 * into.
 */
export const MEDIA_ENDPOINTS = {
    /** Posts and comments. */
    post: "/media",
    /** Direct messages. */
    message: "/messages/media",
} as const;

export type MediaEndpoint =
    (typeof MEDIA_ENDPOINTS)[keyof typeof MEDIA_ENDPOINTS];

/**
 * Uploads what has been picked and answers the URLs to attach.
 *
 * Neither endpoint belongs to one feature: a post and a comment both send
 * their attachments to `/media`, and a message sends its own to
 * `/messages/media`. Keeping the call in `features/feed` meant the comment box
 * could not reach it without crossing a boundary — and crossing it would have
 * been the wrong fix for an endpoint neither feature owns.
 *
 * The endpoint is a parameter rather than a second copy of this function,
 * because the part worth not having twice is everything around the call: the
 * `FormData` header rule below and the one-shot 503 retry.
 *
 * `contentType: false` because the body is `FormData`: setting the header
 * ourselves would write `multipart/form-data` without the boundary the runtime
 * generates, and the server would fail to parse a body it was handed
 * correctly.
 *
 * `withModerationRetry` absorbs exactly one 503 from the moderation provider.
 * One blink is worth hiding; an outage is not something to bury under a
 * spinner that never ends, so the second failure reaches the caller — which
 * keeps the files and lets the person try again themselves.
 *
 * @param assets - What the picker returned
 * @param endpoint - Which channel the files belong to
 * @returns The URLs to attach, in the order the files were sent
 */
export async function uploadMedia(
    assets: PickedAsset[],
    endpoint: MediaEndpoint = MEDIA_ENDPOINTS.post,
): Promise<string[]> {
    if (assets.length === 0) return [];

    const { mediaUrls } = await withModerationRetry(() =>
        api.post<{ mediaUrls: string[] }>(endpoint, buildMediaForm(assets), {
            contentType: false,
        }),
    );

    return mediaUrls;
}
