import { useCallback, useEffect, useState } from "react";

import { FOLLOW_LIST_PAGE_SIZE, profileApi } from "../../data/profile.api";
import type { FollowListType, FollowUser } from "../../data/profile.types";
import { getErrorMessage } from "@shared/utils/error-handler";

/**
 * One side of an account's follow relationships.
 *
 * **Paged by offset, not by a page counter**, which is what the endpoint takes
 * and also what stays correct when a page comes back short — the endpoint
 * allows that, and a counter would then skip the rows in between.
 *
 * Loading is derived from which list has been fetched, as in `useProfile`: the
 * key is `username:type`, so switching between followers and following shows a
 * spinner rather than the other list for a frame.
 */
export function useFollowList(username: string, type: FollowListType) {
    const [users, setUsers] = useState<FollowUser[]>([]);
    const [fetchedKey, setFetchedKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const currentKey = `${username}:${type}`;
    const isLoading = currentKey !== fetchedKey;

    useEffect(() => {
        let cancelled = false;

        const read =
            type === "followers"
                ? profileApi.getFollowers
                : profileApi.getFollowing;

        read(username, { limit: FOLLOW_LIST_PAGE_SIZE, offset: 0 })
            .then((data) => {
                if (cancelled) return;
                setUsers(data);
                // The endpoint reports a total in `meta`, but `apiClient`
                // unwraps `data` before anyone sees it — so a full page is the
                // only signal that there is another behind it.
                setHasMore(data.length === FOLLOW_LIST_PAGE_SIZE);
                setError(null);
                setFetchedKey(`${username}:${type}`);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(getErrorMessage(err));
                setHasMore(false);
                setFetchedKey(`${username}:${type}`);
            });

        return () => {
            cancelled = true;
        };
    }, [username, type]);

    const loadMore = useCallback(() => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);

        const read =
            type === "followers"
                ? profileApi.getFollowers
                : profileApi.getFollowing;

        read(username, {
            limit: FOLLOW_LIST_PAGE_SIZE,
            offset: users.length,
        })
            .then((data) => {
                setUsers((prev) => [...prev, ...data]);
                setHasMore(data.length === FOLLOW_LIST_PAGE_SIZE);
            })
            .catch((err: unknown) => setError(getErrorMessage(err)))
            .finally(() => setIsLoadingMore(false));
    }, [username, type, users.length, hasMore, isLoadingMore]);

    /** Follow state for one row, applied where the list holds it. */
    const patchUser = useCallback((userId: string, isFollowing: boolean) => {
        setUsers((prev) =>
            prev.map((user) =>
                user.userId === userId ? { ...user, isFollowing } : user,
            ),
        );
    }, []);

    return {
        users,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        patchUser,
    };
}
