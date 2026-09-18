import { useCallback, useEffect, useRef, useState } from "react";

import { ARTICLE_PAGE_LIMIT, articleApi } from "../../data/article.api";
import type { ArticleSummary } from "../../data/article.types";
import { getErrorMessage } from "@shared/utils/error-handler";

/**
 * The article list, paged.
 *
 * `page`/`limit` rather than a cursor, because that is what the endpoint
 * takes — and "is there more" is answered the way every other paged list in
 * this app answers it: a page that came back full. There is no total in the
 * response, and a count would be stale by the next request anyway.
 *
 * The rows live here rather than in a store, and what the reader *changes*
 * about one does not: a like made on the reading screen has to reach the row
 * behind it, and that goes through `article-overlay.store` rather than through
 * a copy handed up and down this list.
 */
export function useArticles() {
    const [articles, setArticles] = useState<ArticleSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    /** The last page asked for, so `loadMore` knows what comes next. */
    const pageRef = useRef(1);

    /**
     * Which read is the current one, so a superseded answer — a slow first
     * page landing after a retry — cannot write over a newer one.
     */
    const generation = useRef(0);

    /**
     * Whether a page is already out. A ref rather than the state, because
     * state is read through a closure and raised a render later: a `FlatList`
     * firing `onEndReached` twice inside one tick would ask for the same page
     * twice and append every row of it twice.
     */
    const inFlight = useRef(false);

    const load = useCallback(async () => {
        const run = ++generation.current;

        try {
            const page = await articleApi.getArticles({ page: 1 });
            if (generation.current !== run) return;

            pageRef.current = 1;
            setArticles(page);
            setHasMore(page.length === ARTICLE_PAGE_LIMIT);
            setLoadMoreError(null);
            setError(null);
        } catch (err) {
            if (generation.current !== run) return;

            setArticles([]);
            setHasMore(false);
            setError(getErrorMessage(err));
        } finally {
            if (generation.current === run) setIsLoading(false);
        }
    }, []);

    /** The retry. An event, so the spinner may come back up. */
    const retry = useCallback(async () => {
        setIsLoading(true);
        await load();
    }, [load]);

    const loadMore = useCallback(async () => {
        if (inFlight.current || !hasMore) return;

        const run = generation.current;
        const next = pageRef.current + 1;

        inFlight.current = true;
        setIsLoadingMore(true);
        setLoadMoreError(null);

        try {
            const page = await articleApi.getArticles({ page: next });
            if (generation.current !== run) return;

            // The counter moves only once the page is in hand. Advanced first,
            // a failed page two is never retried — the next attempt asks for
            // page three and those articles become unreachable.
            pageRef.current = next;
            setArticles((held) => [...held, ...page]);
            setHasMore(page.length === ARTICLE_PAGE_LIMIT);
        } catch (err) {
            if (generation.current === run) {
                setLoadMoreError(getErrorMessage(err));
            }
        } finally {
            setIsLoadingMore(false);
            inFlight.current = false;
        }
    }, [hasMore]);

    /*
     * `set-state-in-effect` follows `load` into the callback and finds the
     * writes inside it. None runs synchronously: every one is in a promise
     * continuation a full round trip after this effect has returned, which is
     * the "update it from the event that caused the change" the rule exists to
     * steer towards. Hiding them one call level deeper until the linter stops
     * noticing would be the same code with worse structure.
     */
    useEffect(() => {
        // eslint-disable-next-line react/set-state-in-effect
        void load();

        return () => {
            generation.current += 1;
        };
    }, [load]);

    return {
        articles,
        isLoading,
        isLoadingMore,
        error,
        loadMoreError,
        hasMore,
        retry,
        loadMore,
    };
}
