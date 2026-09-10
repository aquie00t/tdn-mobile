import { useCallback, useRef, useState } from "react";

import { assertList } from "@shared/utils/assert-list";
import { PAGE_LIMIT, feedApi } from "../../data/feed.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import type { Post } from "../../data/feed.types";

/**
 * One account's posts.
 *
 * Lives with the feed rather than with the profile because it answers posts:
 * the type and the card that draw them are the feed's, and a feature may not
 * reach into another for either. The profile screen composes the two.
 *
 * Loading is derived from which account has been fetched, as `useProfile`
 * derives it — moving from one profile to another must not show the previous
 * account's posts for a frame, and a flag that has to be set leaves exactly
 * one render in which it does.
 */
export function useUserPosts(username: string) {
    const [posts, setPosts] = useState<Post[]>([]);
    const [fetchedUsername, setFetchedUsername] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const requestRef = useRef(0);

    const isLoading = fetchedUsername !== username;

    const fetchPosts = useCallback(async () => {
        const requestId = ++requestRef.current;

        try {
            const data = await feedApi.getUserPosts(username, {
                page: 1,
                limit: PAGE_LIMIT,
            });
            if (requestId !== requestRef.current) return;
            // Checked before the first write, so a mis-shaped payload fails
            // inside the request that caused it rather than on a later render.
            assertList(data);
            setPosts(data);
            setHasMore(data.length === PAGE_LIMIT);
            setPage(1);
            setError(null);
            setFetchedUsername(username);
        } catch (err) {
            if (requestId !== requestRef.current) return;
            setError(getErrorMessage(err));
            setHasMore(false);
            setFetchedUsername(username);
        }
    }, [username]);

    const loadMore = useCallback(() => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const nextPage = page + 1;

        feedApi
            .getUserPosts(username, { page: nextPage, limit: PAGE_LIMIT })
            .then((data) => {
                assertList(data);
                setPosts((prev) => [...prev, ...data]);
                setHasMore(data.length === PAGE_LIMIT);
                // Advanced only once the page is in hand, or a failed page two
                // is skipped and those posts become unreachable.
                setPage(nextPage);
            })
            .catch((err: unknown) => setError(getErrorMessage(err)))
            .finally(() => setIsLoadingMore(false));
    }, [username, page, hasMore, isLoadingMore]);

    const retry = useCallback(() => {
        setError(null);
        setFetchedUsername(null);
        void fetchPosts();
    }, [fetchPosts]);

    const replacePost = useCallback((updated: Post) => {
        setPosts((prev) =>
            prev.map((post) => (post.id === updated.id ? updated : post)),
        );
    }, []);

    return {
        // No overlay applied here: `PostCard` reads it itself, so the reader's
        // own likes show on this list without it being mapped twice.
        posts,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        fetchPosts,
        retry,
        replacePost,
    };
}
