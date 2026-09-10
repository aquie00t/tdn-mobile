import { useCallback, useMemo, useState } from "react";

import { COMMENT_PAGE_LIMIT, commentApi } from "../../data/comment.api";
import { appendNewOnly } from "@shared/utils/append-new-only";
import type { Comment, CommentTarget } from "../../data/comment.types";
import { getErrorMessage } from "@shared/utils/error-handler";

/**
 * A target's comments, newest first.
 *
 * Ported from the web, minus its `isAuthenticated` argument: it decided
 * whether to send the request as public, and on this client — which has no
 * guest browsing — it was always going to be true.
 */
export function useComments(target: CommentTarget) {
    // Callers pass the target as an object literal, which is a fresh reference
    // on every render. Depending on it directly would rebuild `fetchComments`
    // each time, and the screen calls that from an effect keyed on it — one
    // render would schedule the next, forever. Rebuilding from the two
    // primitives pins the identity to what actually identifies the target.
    const { type: targetType, id: targetId } = target;
    const stableTarget = useMemo<CommentTarget>(
        () =>
            targetType === "article"
                ? { type: "article", id: targetId }
                : { type: "post", id: targetId },
        [targetType, targetId],
    );

    const [comments, setComments] = useState<Comment[]>([]);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchComments = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await commentApi.getComments(stableTarget, {
                page: 1,
                limit: COMMENT_PAGE_LIMIT,
            });
            setComments(data);
            // `meta` carries the page and limit back and never a total, so a
            // full page is the only signal that there is another behind it.
            setHasMore(data.length === COMMENT_PAGE_LIMIT);
            setPage(1);
        } catch (err) {
            setError(getErrorMessage(err));
            setHasMore(false);
        } finally {
            setIsLoading(false);
        }
    }, [stableTarget]);

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const nextPage = page + 1;

        try {
            const data = await commentApi.getComments(stableTarget, {
                page: nextPage,
                limit: COMMENT_PAGE_LIMIT,
            });
            setComments((prev) => appendNewOnly(prev, data));
            setHasMore(data.length === COMMENT_PAGE_LIMIT);
            setPage(nextPage);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoadingMore(false);
        }
    }, [stableTarget, page, hasMore, isLoadingMore]);

    const addComment = useCallback((comment: Comment) => {
        setComments((prev) => [comment, ...prev]);
    }, []);

    return {
        comments,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        fetchComments,
        retry: fetchComments,
        loadMore,
        addComment,
    };
}
