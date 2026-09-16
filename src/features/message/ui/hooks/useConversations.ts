import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@shared/utils/error-handler";
import { CONVERSATION_PAGE_LIMIT, messageApi } from "../../data/message.api";
import type { ConversationListStatus } from "../../data/message.types";
import { useMessageStore } from "../store/message.store";

/**
 * One tab of the inbox: `ACCEPTED` for conversations, `PENDING` for requests.
 *
 * **Cursor-paginated rather than numbered**, and that is not a style choice —
 * this list reorders every time a message arrives, so page two of a numbered
 * listing would skip and repeat rows as people write to each other. The whole
 * `{ data, meta }` document comes back through `api.getPage`, `nextCursor` is
 * handed straight back, and `null` is the end.
 *
 * The rows live in the store rather than here, because the socket writes to
 * them too — a hook holding its own copy would be a second list that a
 * realtime reorder could not reach.
 *
 * @param status - Which tab this instance backs
 */
export function useConversations(status: ConversationListStatus) {
    const isRequests = status === "PENDING";

    const setConversations = useMessageStore((s) => s.setConversations);
    const setRequests = useMessageStore((s) => s.setRequests);
    const cursor = useMessageStore((s) =>
        isRequests ? s.requestsCursor : s.conversationsCursor,
    );
    const revision = useMessageStore((s) =>
        isRequests ? s.requestsRevision : s.conversationsRevision,
    );

    // The first page is always on its way, so this starts true rather than
    // being switched on from inside the effect that starts it.
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * How many pages are in the list.
     *
     * The thing that makes "reload from the top" safe to do behind somebody's
     * back — see `reloadFromTop`. `0` until the first page has landed, so the
     * mount load is distinguishable from a list that is merely empty.
     */
    const pagesLoaded = useRef(0);

    /**
     * Which read is the current one. Bumped when the list restarts and again
     * when the hook goes away, so an answer that has been superseded — a slow
     * first page landing after a retry, or after a revision bump — cannot
     * write over a newer one.
     */
    const generation = useRef(0);

    /**
     * Whether a page is already out. A ref rather than `isLoadingMore`,
     * because state is read through a closure and raised a render later: a
     * `FlatList` firing `onEndReached` twice inside one tick would ask for the
     * same cursor twice and append every row of it twice.
     */
    const inFlight = useRef(false);

    const store = isRequests ? setRequests : setConversations;

    const loadPage = useCallback(
        async (nextCursor: string | null, append: boolean) => {
            const run = ++generation.current;

            try {
                const page = await messageApi.getConversations(status, {
                    limit: CONVERSATION_PAGE_LIMIT,
                    cursor: nextCursor,
                });

                if (generation.current !== run) return;

                store(page.data, page.meta?.nextCursor ?? null, append);
                pagesLoaded.current = append ? pagesLoaded.current + 1 : 1;
                setError(null);
            } catch (err) {
                if (generation.current !== run) return;
                setError(getErrorMessage(err));
            } finally {
                /*
                 * Lowered here rather than by the caller, so the one path that
                 * raises it — the retry — is the only one that has to think
                 * about it, and the mount load needs no state write of its own
                 * inside the effect that starts it.
                 */
                if (generation.current === run) setIsLoading(false);
            }
        },
        [status, store],
    );

    /** The retry. An event handler, so the spinner may come back up. */
    const refresh = useCallback(async () => {
        setIsLoading(true);
        await loadPage(null, false);
    }, [loadPage]);

    /**
     * The pull gesture: the same reload, asked for rather than done quietly.
     *
     * This is the way back for a reader who has paged in, because the quiet
     * reload below refuses to touch a list that deep. The list stays on screen
     * under the platform's own indicator rather than being replaced by a
     * spinner, which is the difference from `refresh`.
     */
    const pullToRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await loadPage(null, false);
        setIsRefreshing(false);
    }, [loadPage]);

    /**
     * The first page again, quietly — and **only while the list is still one
     * page long**.
     *
     * Why it is wanted: the socket is closed for the whole time the app is in
     * the background, deliberately, so everything that arrived in that window
     * reached nobody and the rows on screen may be hours stale. Raising
     * `isLoading` for that would replace a correct-looking list with a spinner
     * on every return to the tab.
     *
     * Why it is refused past one page: a first page does not extend the list,
     * it *replaces* it. A reader sixty conversations deep who glances at their
     * profile and comes back would find the list cut to twenty while the
     * scroll position stayed where it was — parked past the end of the
     * content, with the pages they had loaded gone and no cursor left to ask
     * for them again. Being a little stale is the smaller failure, and the
     * pull gesture above is there for anyone who disagrees.
     *
     * `0` is refused for a different reason: nothing has landed yet, so the
     * mount load already owns this read and a second one would only race it.
     */
    const reloadFromTop = useCallback(async () => {
        if (pagesLoaded.current !== 1) return;
        await loadPage(null, false);
    }, [loadPage]);

    const loadMore = useCallback(async () => {
        /*
         * Read at call time rather than closed over, so this keeps one
         * identity across pages. No cursor means the end of the listing, not a
         * first page — passing `null` would silently restart from the top and
         * duplicate every row already on screen.
         */
        const state = useMessageStore.getState();
        const next = isRequests
            ? state.requestsCursor
            : state.conversationsCursor;
        if (inFlight.current || !next) return;

        inFlight.current = true;
        setIsLoadingMore(true);
        await loadPage(next, true);
        setIsLoadingMore(false);
        inFlight.current = false;
    }, [isRequests, loadPage]);

    /*
     * The mount load, and the re-read realtime asks for.
     *
     * `revision` is the dependency doing the second half of that: the socket
     * payload is a preview rather than a row, so a message for a thread this
     * page does not hold leaves nothing to insert — only a reason to ask
     * again. A payload for a row that *is* loaded reorders it in the store and
     * never touches the revision, so the common case costs no request.
     *
     * The suppression on the dependency array is deliberate:
     * `exhaustive-effect-dependencies` calls `revision` extra because the body
     * never reads it, and that is exactly what it is for — a counter whose
     * only purpose is to be depended on. Dropping it would leave a list that
     * never hears about a conversation it does not already hold.
     */
    useEffect(() => {
        // Past the first page this is the same replacement `reloadFromTop`
        // refuses, arriving mid-scroll instead of on focus. The row realtime
        // could not place will be there the next time the list is asked for
        // from the top.
        if (pagesLoaded.current > 1) return;

        void loadPage(null, false);

        return () => {
            generation.current += 1;
        };
        // eslint-disable-next-line react/exhaustive-effect-dependencies
    }, [loadPage, revision]);

    return {
        refresh,
        pullToRefresh,
        reloadFromTop,
        isLoading,
        isLoadingMore,
        isRefreshing,
        error,
        hasMore: cursor !== null,
        loadMore,
    };
}
