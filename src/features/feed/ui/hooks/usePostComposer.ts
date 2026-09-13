import { useCallback, useRef, useState } from "react";

import { feedApi } from "../../data/feed.api";
import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import { newIdempotencyKey } from "@core/api/idempotency";
import type { Post } from "../../data/feed.types";
import { reportError } from "@shared/utils/report-error";
import { useMediaSelection } from "@shared/hooks/useMediaSelection";

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
    const [content, setContentState] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    /**
     * The server's answer, when it is one the writer has to act on — a file
     * that was refused, a rate limit, a body it would not take. Our own
     * failures leave this empty; see `submit`.
     */
    const [error, setError] = useState<string | null>(null);
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

    /** Typing retracts the answer to the previous attempt. */
    const setContent = useCallback((next: string) => {
        setContentState(next);
        setError(null);
    }, []);

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
        setError(null);

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
            setContentState("");
            media.clear();
            onPosted(post);
        } catch (err) {
            /*
             * Nothing is lost either way: the composer stays open with the
             * text in it, the send button comes back, and the next tap retries
             * under the same key.
             *
             * What is *said* depends on whose failure it was. Ours — the
             * network, a 500 — says nothing; the reason goes to `reportError`.
             * The server's answer is shown under the field, because the writer
             * has to act on it: a refused file has just been taken out of the
             * picker by `handleFailure`, and without a sentence it would simply
             * vanish; a rate limit or a rejected body would fail the same way
             * on every tap with nothing saying why.
             */
            media.handleFailure(err);
            reportError("post.create", err);

            const message = getErrorMessage(err);
            if (!isOurFailure(message)) setError(message);
        } finally {
            setIsSubmitting(false);
        }
    }, [canSubmit, media, trimmed, quotedPostId, onPosted]);

    return {
        content,
        setContent,
        media,
        isSubmitting,
        isTooLong,
        canSubmit,
        submit,
        error,
        isQuote: Boolean(quotedPostId),
    };
}
