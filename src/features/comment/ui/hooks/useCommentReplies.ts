import { useCallback, useState } from "react";

import { COMMENT_PAGE_LIMIT, commentApi } from "../../data/comment.api";
import { appendNewOnly } from "../../domain/append-new-only";
import type { Comment } from "../../data/comment.types";
import { getErrorMessage } from "@shared/utils/error-handler";

/**
 * The replies under one comment, fetched only once somebody opens them.
 *
 * A thread of twenty comments would otherwise make twenty requests before the
 * reader has decided to read any of them, and most threads are never opened.
 * `fetchReplies` is called by the card when it expands.
 */
export function useCommentReplies(commentId: string) {
    const [replies, setReplies] = useState<Comment[]>([]);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReplies = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await commentApi.getReplies(commentId, {
                page: 1,
                limit: COMMENT_PAGE_LIMIT,
            });
            setReplies(data);
            setHasMore(data.length === COMMENT_PAGE_LIMIT);
            setPage(1);
        } catch (err) {
            setError(getErrorMessage(err));
            setHasMore(false);
        } finally {
            setIsLoading(false);
        }
    }, [commentId]);

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const nextPage = page + 1;

        try {
            const data = await commentApi.getReplies(commentId, {
                page: nextPage,
                limit: COMMENT_PAGE_LIMIT,
            });
            setReplies((prev) => appendNewOnly(prev, data));
            setHasMore(data.length === COMMENT_PAGE_LIMIT);
            setPage(nextPage);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoadingMore(false);
        }
    }, [commentId, page, hasMore, isLoadingMore]);

    const addReply = useCallback((reply: Comment) => {
        setReplies((prev) => [reply, ...prev]);
    }, []);

    return {
        replies,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        fetchReplies,
        loadMore,
        addReply,
    };
}
