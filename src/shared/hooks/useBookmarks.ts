import { useCallback, useEffect, useRef, useState } from "react";

import { BOOKMARKS_PAGE_SIZE, bookmarksApi } from "../data/bookmarks.api";
import { getErrorMessage } from "../utils/error-handler";

/** Enough of an item to be removed from a list by identity. */
interface Identified {
    id: string;
}

/**
 * Everything the reader has saved, paged.
 *
 * Generic for the reason the API module is: one endpoint answers posts,
 * comments and articles together, and the types of those three belong to three
 * features that may not import one another. None of the paging below cares
 * what any of them is — only that each has an `id` — so the screen supplies
 * the types and this supplies the sequencing.
 *
 * **"Is there more" is a question per list, not per request.** The web keeps
 * one flag, raised when *any* of the three came back full; that is right for a
 * page that renders all three at once and wrong for tabs, where it puts a
 * "show more" under a finished list because a different tab has more behind
 * it. Pressing it appends nothing visible, which reads as broken.
 *
 * The totals in `meta` would answer it outright, and are out of reach:
 * `apiClient` unwraps `data`, and `api.getPage` — the one caller that sees an
 * envelope — is documented as being for cursor-paginated endpoints only. A
 * full page of a kind is the signal left, and it is the same one the rest of
 * this app's `page`/`limit` lists use.
 */
export function useBookmarks<
    TPost extends Identified,
    TComment extends Identified,
>() {
    const [posts, setPosts] = useState<TPost[]>([]);
    const [comments, setComments] = useState<TComment[]>([]);
    const [hasMorePosts, setHasMorePosts] = useState(false);
    const [hasMoreComments, setHasMoreComments] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /**
     * A *page* that failed, kept apart from a first read that failed.
     *
     * `FeedScreen` separates the two for the reason this screen needs it more:
     * the error slot is rendered next to the rows it belongs to, and one slot
     * shared with the first-page failure puts a message about a posts page
     * under a finished list of comments, where there is nothing to retry it
     * with.
     */
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

    /** The last page asked for, so `loadMore` knows what comes next. */
    const pageRef = useRef(1);

    /**
     * Which read is the current one. Bumped when the list is restarted and
     * again when the hook goes away, so a superseded answer cannot write over
     * a newer one — `retry` restarts from outside the effect and has no
     * cancellation flag of its own.
     */
    const generation = useRef(0);

    /**
     * Whether a page is already out.
     *
     * A ref rather than the `isLoadingMore` state, because state is read
     * through a closure and raised a render later — and this screen wires
     * *two* triggers to one call, a footer button and `onEndReached`. Both
     * firing inside one tick would compute the same next page and append it
     * twice, which is duplicate rows under duplicate keys.
     */
    const inFlight = useRef(false);

    const load = useCallback((): Promise<void> => {
        const run = ++generation.current;

        return bookmarksApi
            .getBookmarks<TPost, TComment>({
                page: 1,
                limit: BOOKMARKS_PAGE_SIZE,
            })
            .then((page) => {
                if (generation.current !== run) return;

                pageRef.current = 1;
                setLoadMoreError(null);
                setPosts(page.posts);
                setComments(page.comments);
                setHasMorePosts(page.posts.length === BOOKMARKS_PAGE_SIZE);
                setHasMoreComments(
                    page.comments.length === BOOKMARKS_PAGE_SIZE,
                );
                setError(null);
            })
            .catch((err: unknown) => {
                if (generation.current !== run) return;

                setPosts([]);
                setComments([]);
                setHasMorePosts(false);
                setHasMoreComments(false);
                setError(getErrorMessage(err));
            })
            .finally(() => {
                if (generation.current === run) setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        void load();

        return () => {
            generation.current += 1;
        };
    }, [load]);

    /** An event, so the spinner can go up straight away. */
    const retry = useCallback(() => {
        setIsLoading(true);
        setError(null);
        void load();
    }, [load]);

    /**
     * The next page of everything.
     *
     * One button on either tab asks for the same page, because the endpoint
     * pages the kinds together. A tab whose own list is finished simply
     * receives nothing new for it, which is why the button is only offered
     * where that list can still grow.
     */
    const loadMore = useCallback((): Promise<void> => {
        if (inFlight.current || (!hasMorePosts && !hasMoreComments)) {
            return Promise.resolve();
        }

        inFlight.current = true;

        const run = generation.current;
        const next = pageRef.current + 1;

        setIsLoadingMore(true);

        return bookmarksApi
            .getBookmarks<TPost, TComment>({
                page: next,
                limit: BOOKMARKS_PAGE_SIZE,
            })
            .then((page) => {
                if (generation.current !== run) return;

                pageRef.current = next;
                setPosts((previous) => [...previous, ...page.posts]);
                setComments((previous) => [...previous, ...page.comments]);
                setHasMorePosts(page.posts.length === BOOKMARKS_PAGE_SIZE);
                setHasMoreComments(
                    page.comments.length === BOOKMARKS_PAGE_SIZE,
                );
                // A page that failed and was tried again leaves its message
                // behind otherwise: the rows arrive, and the reader is still
                // being told they did not.
                setLoadMoreError(null);
            })
            .catch((err: unknown) => {
                if (generation.current !== run) return;
                // Its own slot, not the one a first read failed into: the rows
                // that did arrive stay, and the message appears under the list
                // it belongs to, where there is a button to try it again.
                setLoadMoreError(getErrorMessage(err));
            })
            .finally(() => {
                // Unconditional: nothing else lowers these, so a superseded
                // page that left them raised would disable the button for
                // good.
                inFlight.current = false;
                setIsLoadingMore(false);
            });
    }, [hasMorePosts, hasMoreComments]);

    /** Pressing the message is what tries the page again. */
    const retryLoadMore = useCallback(() => {
        setLoadMoreError(null);
        void loadMore();
    }, [loadMore]);

    /**
     * A post deleted from its own card, gone from this list too.
     *
     * Nothing calls it yet: the card has no delete affordance until that PR
     * lands, and `useFeed` carries the same pair for the same reason. It is
     * here so the screen that gains one has somewhere to report it.
     */
    const removePost = useCallback((postId: string) => {
        setPosts((previous) => previous.filter((post) => post.id !== postId));
    }, []);

    /**
     * A freshly read copy of one post, in place.
     *
     * Unsaving is deliberately **not** this: the card keeps its own row when
     * the bookmark comes off, so somebody who taps it by accident still has a
     * row to tap back. The list catches up the next time it is opened.
     */
    const replacePost = useCallback((updated: TPost) => {
        setPosts((previous) =>
            previous.map((post) => (post.id === updated.id ? updated : post)),
        );
    }, []);

    return {
        posts,
        comments,
        isLoading,
        isLoadingMore,
        error,
        loadMoreError,
        hasMorePosts,
        hasMoreComments,
        retry,
        retryLoadMore,
        loadMore,
        removePost,
        replacePost,
    };
}
