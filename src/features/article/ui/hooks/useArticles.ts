import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "expo-router";

import { ARTICLE_PAGE_LIMIT, articleApi } from "../../data/article.api";
import type { ArticleStatus, ArticleSummary } from "../../data/article.types";
import { getErrorMessage } from "@shared/utils/error-handler";
import { reportError } from "@shared/utils/report-error";
import { useArticleRevisionStore } from "../store/article-revision.store";

/**
 * Which articles a list shows.
 *
 * - `all` — everything published, the feed's Articles tab.
 * - `author` — one account's published articles, on their profile.
 * - `mine` — your own, from `/articles/me`, the only endpoint that returns a
 *   draft. The status narrows it; the web shows one status at a time too.
 */
export type ArticleQuery =
    | { scope: "all" }
    | { scope: "author"; username: string }
    | { scope: "mine"; status: ArticleStatus };

const ALL: ArticleQuery = { scope: "all" };

function fetchPage(
    query: ArticleQuery,
    page: number,
): Promise<ArticleSummary[]> {
    switch (query.scope) {
        case "mine":
            return articleApi.getMyArticles({ page, status: query.status });
        case "author":
            return articleApi.getArticles({
                page,
                authorUsername: query.username,
            });
        default:
            return articleApi.getArticles({ page });
    }
}

/** What one read answered, and which query it answered. */
interface Loaded {
    key: string;
    articles: ArticleSummary[];
    hasMore: boolean;
    error: string | null;
}

/**
 * An article list, paged.
 *
 * `page`/`limit` rather than a cursor, because that is what both endpoints
 * take — and "is there more" is answered the way every other paged list here
 * answers it: a page that came back full.
 *
 * **The rows are tagged with the query they answer.** Switching a profile from
 * Drafts to Published changes the query while the old answer is still on
 * screen; drawn from a result keyed to the old query, the list is simply
 * "loading" until the new one lands, rather than showing drafts under the
 * Published chip for a round trip.
 *
 * **It follows the editor.** Every save that lands bumps a counter in
 * `article-revision.store`, and a counter this list has not read is read again
 * once the list is in view — so a published article appears, a deleted one
 * goes, and a draft that gained a title shows it, without a pull to refresh.
 * Not while the editor is on top: that would be a request per autosave for a
 * list nobody can see.
 *
 * What the reader *changes* about a row — a like, a save — does not live
 * here; it goes through `article-overlay.store`.
 *
 * @param query - Which articles; `all` when absent
 */
export function useArticles(query: ArticleQuery = ALL) {
    const key = JSON.stringify(query);

    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

    /** The last page asked for, so `loadMore` knows what comes next. */
    const pageRef = useRef(1);

    /**
     * Which read is the current one, so a superseded answer — a slow first
     * page landing after the query changed — cannot write over a newer one.
     */
    const generation = useRef(0);

    /**
     * Whether a page is already out. A ref rather than the state, because
     * state is read through a closure and raised a render later: a `FlatList`
     * firing `onEndReached` twice inside one tick would ask for the same page
     * twice and append every row of it twice.
     */
    const inFlight = useRef(false);

    /**
     * Whether a first page is being read again under rows already showing.
     * `loadMore` waits it out: a page asked for now would be numbered from the
     * old list and land after the new page one — page four straight after
     * page one, and two and three never shown.
     */
    const isReloading = useRef(false);

    const load = useCallback(async () => {
        const run = ++generation.current;
        const asked = JSON.parse(key) as ArticleQuery;
        isReloading.current = true;

        try {
            const page = await fetchPage(asked, 1);
            if (generation.current !== run) return;

            pageRef.current = 1;
            setLoadMoreError(null);
            setLoaded({
                key,
                articles: page,
                hasMore: page.length === ARTICLE_PAGE_LIMIT,
                error: null,
            });
        } catch (err) {
            if (generation.current !== run) return;

            /*
             * A read under rows already showing — coming back from the editor
             * — keeps them when it fails. They were fine a moment ago, and
             * swapping a list for an error screen over a refresh nobody asked
             * for takes away what the reader was looking at. Only a list with
             * nothing to show says it could not load.
             */
            reportError("articles.load", err);
            const message = getErrorMessage(err);
            setLoaded((held) =>
                held && held.key === key && held.articles.length > 0
                    ? held
                    : { key, articles: [], hasMore: false, error: message },
            );
        } finally {
            if (generation.current === run) {
                isReloading.current = false;
                setIsRetrying(false);
            }
        }
    }, [key]);

    /** The retry. An event, so the spinner may come back up. */
    const retry = useCallback(async () => {
        setIsRetrying(true);
        await load();
    }, [load]);

    const current = loaded?.key === key ? loaded : null;
    const hasMore = current?.hasMore ?? false;

    const loadMore = useCallback(async () => {
        if (inFlight.current || isReloading.current || !hasMore) return;

        const run = generation.current;
        const next = pageRef.current + 1;

        inFlight.current = true;
        setIsLoadingMore(true);
        setLoadMoreError(null);

        try {
            const page = await fetchPage(JSON.parse(key) as ArticleQuery, next);
            if (generation.current !== run) return;

            // The counter moves only once the page is in hand. Advanced first,
            // a failed page two is never retried — the next attempt asks for
            // page three and those articles become unreachable.
            pageRef.current = next;
            setLoaded((held) =>
                held && held.key === key
                    ? {
                          ...held,
                          articles: [...held.articles, ...page],
                          hasMore: page.length === ARTICLE_PAGE_LIMIT,
                      }
                    : held,
            );
        } catch (err) {
            if (generation.current === run) {
                setLoadMoreError(getErrorMessage(err));
            }
        } finally {
            setIsLoadingMore(false);
            inFlight.current = false;
        }
    }, [hasMore, key]);

    /*
     * `set-state-in-effect` follows `load` into the callback and finds the
     * writes inside it. None runs synchronously: every one is in a promise
     * continuation a full round trip after this effect has returned.
     */
    useEffect(() => {
        // eslint-disable-next-line react/set-state-in-effect
        void load();

        return () => {
            generation.current += 1;
        };
    }, [load]);

    const revision = useArticleRevisionStore((s) => s.total);
    const isFocused = useIsFocused();
    const readRevision = useRef(revision);
    useEffect(() => {
        if (!isFocused || readRevision.current === revision) return;
        readRevision.current = revision;
        // Quietly: the rows on screen stay until the new ones replace them,
        // and stay if they do not come.
        void load();
    }, [isFocused, revision, load]);

    return {
        articles: current?.articles ?? [],
        isLoading: current === null || isRetrying,
        isLoadingMore,
        error: current?.error ?? null,
        loadMoreError,
        hasMore,
        retry,
        loadMore,
    };
}
