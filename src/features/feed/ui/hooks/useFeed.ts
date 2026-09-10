import { useCallback, useEffect, useRef, useState } from "react";

import { PAGE_LIMIT, feedApi } from "../../data/feed.api";
import { assertList } from "@shared/utils/assert-list";
import type {
    GetPostsParams,
    Post,
    PostCategory,
    PostType,
} from "../../data/feed.types";
import { useI18n } from "@shared/hooks/useI18n";
import { usePostOverlayStore } from "../store/post-overlay.store";

/**
 * The feed's state, ported from the web hook of the same name.
 *
 * **What is deliberately not ported:** the `restore` parameter and the
 * `feed-snapshot.store` behind it. On the web a Back button remounts the page,
 * so the list and the page number the reader had reached have to be handed
 * back from a store or the feed silently starts again at the top. Here the
 * feed screen is not unmounted: pushing a post detail leaves it mounted
 * beneath, and switching tabs leaves it mounted beside. Porting the snapshot
 * would be a store nothing ever writes to and a `page` mirror nothing reads.
 *
 * **What is added:** `refresh`, because a phone has a gesture the web does not.
 * It runs the same request as `fetchPosts` without raising `isLoading`, so the
 * list stays on screen under the pull-to-refresh spinner. Raising the loading
 * flag would blank the feed and throw away the reader's place — a punishment
 * for a gesture that means "check for new posts", not "start over".
 */
export function useFeed(
    followedOnly: boolean = false,
    categories: PostCategory[] = [],
) {
    const { t } = useI18n();

    const [posts, setPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const pageRef = useRef(1);
    const followedOnlyRef = useRef(followedOnly);
    const categoriesRef = useRef(categories);
    const lastFetchParamsRef = useRef<PostType | GetPostsParams | undefined>(
        undefined,
    );
    const requestIdRef = useRef(0);

    useEffect(() => {
        followedOnlyRef.current = followedOnly;
    }, [followedOnly]);

    useEffect(() => {
        categoriesRef.current = categories;
    }, [categories]);

    // Page 2 has to repeat whatever narrowed page 1, so both go through here.
    // Rebuilding `loadMore` from the post type alone dropped a `tag` filter and
    // appended unrelated posts.
    const buildParams = useCallback(
        (
            arg: PostType | GetPostsParams | undefined,
            page: number,
        ): GetPostsParams =>
            typeof arg === "string"
                ? {
                      page,
                      limit: PAGE_LIMIT,
                      type: arg,
                      followedOnly: followedOnlyRef.current,
                      categories: categoriesRef.current,
                  }
                : {
                      page,
                      limit: PAGE_LIMIT,
                      followedOnly: followedOnlyRef.current,
                      categories: categoriesRef.current,
                      ...arg,
                  },
        [],
    );

    const fetchPosts = useCallback(
        async (
            arg?: PostType | GetPostsParams,
            options?: { quiet?: boolean },
        ) => {
            if (!options?.quiet) setIsLoading(true);
            setError(null);
            setLoadMoreError(null);
            pageRef.current = 1;
            lastFetchParamsRef.current = arg;

            // Switching tabs quickly leaves several requests in flight. Only
            // the newest may write state, otherwise a slow earlier response
            // can land last and show posts from the tab you just left.
            const requestId = ++requestIdRef.current;

            try {
                const data = await feedApi.getPosts(buildParams(arg, 1));
                if (requestId !== requestIdRef.current) return;
                // Checked before anything is committed. Reading `.length`
                // straight after `setPosts` looks equivalent, but the throw
                // lands after the state is already holding the bad value: the
                // reader sees the error while `posts` is a `null` that takes
                // the screen down the next time anything touches it.
                assertList(data);
                setPosts(data);
                setHasMore(data.length === PAGE_LIMIT);
                // The server's copy is now the newest thing anybody has, so
                // the reader's own pending changes stop being an improvement
                // on it and start being a way to freeze it.
                usePostOverlayStore.getState().clear();
            } catch {
                if (requestId !== requestIdRef.current) return;
                setError(t("postList.error"));
            } finally {
                if (requestId === requestIdRef.current) setIsLoading(false);
            }
        },
        [t, buildParams],
    );

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const nextPage = pageRef.current + 1;
        const requestId = requestIdRef.current;

        try {
            const data = await feedApi.getPosts(
                buildParams(lastFetchParamsRef.current, nextPage),
            );
            // A tab switch during the request makes this page belong to a feed
            // the reader has already left; appending it would mix the two.
            if (requestId !== requestIdRef.current) return;
            assertList(data);
            setPosts((prev) => [...prev, ...data]);
            setHasMore(data.length === PAGE_LIMIT);
            pageRef.current = nextPage;
        } catch {
            if (requestId !== requestIdRef.current) return;
            setLoadMoreError(t("postList.loadMoreError"));
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMore, t, buildParams]);

    /**
     * The same request, without blanking the list. Repeats whatever narrowed
     * it, so a pull on the Jobs tab does not quietly return the whole feed.
     */
    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        // No `try`/`finally`: `fetchPosts` catches everything it can fail on
        // and reports it through `error`, so there is nothing here that can
        // throw past this line and strand the spinner.
        await fetchPosts(lastFetchParamsRef.current, { quiet: true });
        setIsRefreshing(false);
    }, [fetchPosts]);

    const addPost = useCallback((post: Post) => {
        setPosts((prev) => [post, ...prev]);
    }, []);

    /**
     * Swaps one row for a freshly read copy, leaving the rest of the list and
     * the reader's scroll position where they are. Used when a post's pending
     * video resolves: re-fetching the feed would cost every other row and,
     * behind the 60 s server cache, would usually return the same stale copy.
     */
    const replacePost = useCallback((updated: Post) => {
        setPosts((prev) =>
            prev.map((post) => (post.id === updated.id ? updated : post)),
        );
    }, []);

    const removePost = useCallback((postId: string) => {
        setPosts((prev) => prev.filter((post) => post.id !== postId));
    }, []);

    const retry = useCallback(() => {
        void fetchPosts(lastFetchParamsRef.current);
    }, [fetchPosts]);

    const retryLoadMore = useCallback(() => {
        setLoadMoreError(null);
        void loadMore();
    }, [loadMore]);

    return {
        posts,
        isLoading,
        isRefreshing,
        isLoadingMore,
        error,
        loadMoreError,
        hasMore,
        fetchPosts,
        refresh,
        loadMore,
        retry,
        retryLoadMore,
        // `addPost` waits for composing (PR 11) and `removePost` for
        // deletion; the other two are in use.
        addPost,
        replacePost,
        removePost,
    };
}
