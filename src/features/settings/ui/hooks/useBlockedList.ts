import { useCallback, useRef, useState } from "react";

import { BLOCKED_LIST_PAGE_SIZE, blockApi } from "@shared/data/block.api";
import type { BlockedUser } from "@shared/data/block.types";
import { getErrorMessage } from "@shared/utils/error-handler";

interface BlockedListState {
    users: BlockedUser[];
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
    hasMore: boolean;
}

/**
 * The accounts you have blocked — the only way back to any of them.
 *
 * **Paged by offset, and the offset is what is on screen.** Unblocking removes
 * a row from the server's list as well as this one, so the two shrink together
 * and `users.length` stays the right place to ask from next. A page counter
 * would skip a row after every unblock.
 *
 * Another page is offered when the last one came back full. `meta.total`
 * would say so exactly, but the client unwraps `data` and the endpoint is not
 * cursor-paginated, so `api.getPage` is not the tool for it.
 *
 * The screen calls `load`, on every focus: blocking happens on a profile, and
 * this list opens profiles, so it can be changed from under itself. Only the
 * first read shows a spinner; later ones replace the rows when they land. A
 * failure keeps whatever rows are on screen — taking them away would take
 * their unblock buttons with them.
 */
export function useBlockedList() {
    const [state, setState] = useState<BlockedListState>({
        users: [],
        isLoading: true,
        isLoadingMore: false,
        error: null,
        hasMore: false,
    });

    /** Bumped by every first-page read, so a page from before it is dropped. */
    const requestRef = useRef(0);

    const load = useCallback(async () => {
        const requestId = ++requestRef.current;

        try {
            const users = await blockApi.getBlocked({
                limit: BLOCKED_LIST_PAGE_SIZE,
                offset: 0,
            });
            if (requestId !== requestRef.current) return;
            setState({
                users,
                isLoading: false,
                isLoadingMore: false,
                error: null,
                hasMore: users.length === BLOCKED_LIST_PAGE_SIZE,
            });
        } catch (err) {
            if (requestId !== requestRef.current) return;
            setState((prev) => ({
                ...prev,
                isLoading: false,
                isLoadingMore: false,
                error: getErrorMessage(err),
            }));
        }
    }, []);

    const { isLoadingMore, hasMore } = state;
    const offset = state.users.length;

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        const requestId = requestRef.current;
        setState((prev) => ({ ...prev, isLoadingMore: true, error: null }));

        try {
            const page = await blockApi.getBlocked({
                limit: BLOCKED_LIST_PAGE_SIZE,
                offset,
            });
            if (requestId !== requestRef.current) return;

            setState((prev) => {
                // A block written between the two reads shifts the server's
                // rows by one, and the new page would repeat the last row
                // already here.
                const seen = new Set(prev.users.map((user) => user.userId));
                return {
                    ...prev,
                    users: [
                        ...prev.users,
                        ...page.filter((user) => !seen.has(user.userId)),
                    ],
                    isLoadingMore: false,
                    hasMore: page.length === BLOCKED_LIST_PAGE_SIZE,
                };
            });
        } catch (err) {
            if (requestId !== requestRef.current) return;
            setState((prev) => ({
                ...prev,
                isLoadingMore: false,
                error: getErrorMessage(err),
            }));
        }
    }, [isLoadingMore, hasMore, offset]);

    const retry = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isLoading: prev.users.length === 0,
            error: null,
        }));
        void load();
    }, [load]);

    /**
     * Called after the server has confirmed an unblock, never before it: the
     * row is the only way back to the account, so removing it for a request
     * that then failed would strand the block with nothing pointing at it.
     */
    const remove = useCallback((userId: string) => {
        setState((prev) => ({
            ...prev,
            users: prev.users.filter((user) => user.userId !== userId),
        }));
    }, []);

    return { ...state, load, loadMore, retry, remove };
}
