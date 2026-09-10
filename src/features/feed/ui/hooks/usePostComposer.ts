import { useCallback, useRef, useState } from "react";

import { feedApi } from "../../data/feed.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { newIdempotencyKey } from "@core/api/idempotency";
import type { Post } from "../../data/feed.types";
import { useMediaSelection } from "@shared/hooks/useMediaSelection";
import { useToastStore } from "@shared/store/toast.store";

/** The API's own cap on a post body. Mirrored so its 400 is unreachable. */
export const POST_MAX_LENGTH = 300;

/**
 * Writing a post: what has been picked, what is being uploaded, and what
 * happens when either fails.
 *
 * Everything a person can create here is a `COMMUNITY` post, and that is not a
 * simplification. `TECH_NEWS` and `SYSTEM_UPDATE` are refused for anyone but a
 * bot account, which is also why the web's composer is hidden on those tabs
 * rather than offering a type nobody can use.
 */
export interface UsePostComposerOptions {
    onPosted: (post: Post) => void;
    /**
     * The post being quoted, if any.
     *
     * A quote is a post that carries another, so nothing below branches on it
     * except the two places it must: the body may be empty when there is one —
     * that is the API's plain repost — and no media is offered, because the
     * web does not offer it either and a quote's own attachments would compete
     * with the card it already carries.
     */
    quotedPostId?: string;
}

export function usePostComposer({
    onPosted,
    quotedPostId,
}: UsePostComposerOptions) {
    const addToast = useToastStore((s) => s.addToast);

    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const media = useMediaSelection();

    /**
     * One key for one attempt at *this* post, held across retries.
     *
     * The window it closes is the widest in the flow: the media has uploaded,
     * the create times out, and nobody can say whether the post exists. Under
     * the same key the API answers from the first attempt. Minting a fresh one
     * would both risk a second post and fail anyway — the `mediaUrls` are
     * attached to the first, and re-sending them is `MediaNotOwnedError`.
     */
    const idempotencyKey = useRef<string | null>(null);

    const trimmed = content.trim();
    const isTooLong = trimmed.length > POST_MAX_LENGTH;
    const canSubmit =
        (trimmed.length > 0 ||
            media.assets.length > 0 ||
            Boolean(quotedPostId)) &&
        !isTooLong &&
        !isSubmitting;

    const submit = useCallback(async () => {
        if (!canSubmit) return;

        idempotencyKey.current ??= newIdempotencyKey();
        setIsSubmitting(true);

        try {
            const mediaUrls = await media.upload();

            const post = await feedApi.createPost(
                trimmed,
                "COMMUNITY",
                mediaUrls,
                idempotencyKey.current,
                quotedPostId,
            );

            idempotencyKey.current = null;
            setContent("");
            media.clear();
            onPosted(post);
        } catch (err) {
            media.handleFailure(err);
            addToast({ type: "error", message: getErrorMessage(err) });
        } finally {
            setIsSubmitting(false);
        }
    }, [canSubmit, media, trimmed, quotedPostId, onPosted, addToast]);

    return {
        content,
        setContent,
        media,
        isSubmitting,
        isTooLong,
        canSubmit,
        submit,
        isQuote: Boolean(quotedPostId),
    };
}
