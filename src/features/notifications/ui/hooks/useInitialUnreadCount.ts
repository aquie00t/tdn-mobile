import { useEffect } from "react";

import { notificationApi } from "../../data/notification.api";
import { useNotificationStore } from "../store/notification.store";
import { useSessionStore } from "@core/session/session.store";

/**
 * Seeds the badge at boot, and clears it at sign-out.
 *
 * Only the count. The web fetched the first page here as well and called the
 * result an unread count, which is where the capped badge came from; the list
 * is the notification screen's own business and is read when it opens.
 *
 * Best-effort and silent: a badge that could not be read is not worth a toast
 * on a cold start, and it keeps its last known value rather than dropping to
 * zero and claiming there is nothing to see.
 */
export function useInitialUnreadCount(): void {
    const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
    const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

    useEffect(() => {
        if (!isAuthenticated) {
            // Explicit, because the list no longer defines the count: without
            // this the previous account's badge survives a sign-out.
            setUnreadCount(0);
            return;
        }

        // Guards the sign-out case: an answer landing after this effect has
        // been torn down would repopulate what the branch above just cleared.
        let cancelled = false;

        notificationApi
            .getUnreadCount()
            .then((count) => {
                if (!cancelled) setUnreadCount(count);
            })
            .catch(() => {
                // The badge stays at its last known value.
            });

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, setUnreadCount]);
}
