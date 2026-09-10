import { api } from "@core/api/client";
import { buildMediaForm } from "./asset-to-form";
import type { PickedAsset } from "./asset-to-form";
import { withModerationRetry } from "./media-errors";

/** `/media` refuses a fifth file, so nothing offers one. */
export const MAX_MEDIA_FILES = 4;

/**
 * Uploads what has been picked and answers the URLs to attach.
 *
 * `/media` belongs to no one feature: a post and a comment both send their
 * attachments here, and the channel is fixed when the bytes arrive rather than
 * by which screen sent them. Keeping the call in `features/feed` meant the
 * comment box could not reach it without crossing a boundary — and crossing it
 * would have been the wrong fix for an endpoint neither feature owns.
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
 * @returns The URLs to attach, in the order the files were sent
 */
export async function uploadMedia(assets: PickedAsset[]): Promise<string[]> {
    if (assets.length === 0) return [];

    const { mediaUrls } = await withModerationRetry(() =>
        api.post<{ mediaUrls: string[] }>("/media", buildMediaForm(assets), {
            contentType: false,
        }),
    );

    return mediaUrls;
}
