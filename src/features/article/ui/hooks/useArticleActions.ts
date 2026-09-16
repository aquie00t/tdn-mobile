import { useCallback, useRef } from "react";

import type { ArticleSummary } from "../../data/article.types";
import { articleApi } from "../../data/article.api";
import { reportError } from "@shared/utils/report-error";

export interface UseArticleActionsOptions {
    article: ArticleSummary;
    /** Whoever holds the copy being drawn — a list row, or the reading screen. */
    onChange: (changes: Partial<ArticleSummary>) => void;
}

/**
 * Liking and saving an article.
 *
 * **Optimistic, with a rollback**, as every other counter in this app is: the
 * mark flips on the press and goes back if the server refuses. A like that
 * waited for a round trip on a phone reads as a control that did not register,
 * and the second tap is the one that undoes it.
 *
 * The failure says nothing to the reader — it is ours, the mark is already
 * back where it was, and the reason goes to `reportError`.
 *
 * Note the paths: an article un-likes with `DELETE /articles/:id/like`, where
 * a post un-likes with `DELETE /posts/:id/unlike`. Copying the feed's calls
 * verbatim is a 404 on every undo.
 */
export function useArticleActions({
    article,
    onChange,
}: UseArticleActionsOptions) {
    /**
     * Whether a request for this article is already out.
     *
     * A ref rather than state: two taps inside one tick would both read the
     * same `isLiked`, send the same request twice, and leave the counter one
     * out from the server's with nothing to correct it.
     */
    const likeInFlight = useRef(false);
    const bookmarkInFlight = useRef(false);

    const toggleLike = useCallback(async () => {
        if (likeInFlight.current) return;

        const wasLiked = article.isLiked;
        const wasCount = article.likeCount;

        likeInFlight.current = true;
        onChange({
            isLiked: !wasLiked,
            likeCount: wasCount + (wasLiked ? -1 : 1),
        });

        try {
            if (wasLiked) await articleApi.unlikeArticle(article.id);
            else await articleApi.likeArticle(article.id);
        } catch (err) {
            onChange({ isLiked: wasLiked, likeCount: wasCount });
            reportError("article.like", err);
        } finally {
            likeInFlight.current = false;
        }
    }, [article.id, article.isLiked, article.likeCount, onChange]);

    const toggleBookmark = useCallback(async () => {
        if (bookmarkInFlight.current) return;

        const wasSaved = article.isBookmarked;

        bookmarkInFlight.current = true;
        onChange({ isBookmarked: !wasSaved });

        try {
            if (wasSaved) await articleApi.unbookmarkArticle(article.id);
            else await articleApi.bookmarkArticle(article.id);
        } catch (err) {
            onChange({ isBookmarked: wasSaved });
            reportError("article.bookmark", err);
        } finally {
            bookmarkInFlight.current = false;
        }
    }, [article.id, article.isBookmarked, onChange]);

    return { toggleLike, toggleBookmark };
}
