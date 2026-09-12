import { useCallback, useState } from "react";

import { getErrorMessage } from "@shared/utils/error-handler";
import {
    NOTIFICATION_PAGE_LIMIT,
    notificationApi,
} from "../../data/notification.api";
import { useNotificationStore } from "../store/notification.store";

/**
 * The list, paged.
 *
 * The rows live in the store rather than here, because the socket writes to it
 * too — a hook holding the list would be a second copy that the badge and the
 * realtime increment could not reach.
 */
export function useNotifications() {
    const setNotifications = useNotificationStore((s) => s.setNotifications);

    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    const fetchPage = useCallback(
        async (pageNumber: number, append: boolean) => {
            try {
                const data = await notificationApi.getNotifications(
                    pageNumber,
                    NOTIFICATION_PAGE_LIMIT,
                );
                setNotifications(data, append);
                setHasMore(data.length === NOTIFICATION_PAGE_LIMIT);
                return true;
            } catch (err) {
                setError(getErrorMessage(err));
                return false;
            }
        },
        [setNotifications],
    );

    const fetchNotifications = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setPage(1);
        await fetchPage(1, false);
        setIsLoading(false);
    }, [fetchPage]);

    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        setError(null);
        const nextPage = page + 1;

        // The counter moves only once the page is in hand. Advanced first, a
        // failed page two is never retried — the next attempt asks for page
        // three and those notifications become unreachable.
        if (await fetchPage(nextPage, true)) setPage(nextPage);

        setIsLoadingMore(false);
    }, [isLoadingMore, hasMore, page, fetchPage]);

    return {
        fetchNotifications,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
    };
}
