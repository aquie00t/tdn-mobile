import { useEffect } from "react";

import { messageApi } from "../../data/message.api";
import { useMessageStore } from "../store/message.store";
import { useSessionStore } from "@core/session/session.store";

/**
 * Seeds the messages badge at boot, and clears the inbox at sign-out.
 *
 * Only the count, not the listing: the inbox is a tab somebody visits, and
 * reading twenty conversations on every cold start to render a number the
 * server already knows is the mistake `useInitialUnreadCount` was written to
 * undo. The rows load when the tab does.
 *
 * The request-tab count is deliberately absent here. It has no endpoint —
 * `/conversations/unread-count` covers `ACCEPTED` only, so an unanswered
 * request cannot raise the inbox badge — and it is derived from the `PENDING`
 * listing once that tab is opened.
 *
 * Best-effort and silent: a count that could not be read is not worth saying
 * anything about on a cold start, and it keeps its last known value rather
 * than dropping to zero and claiming there is nothing waiting.
 */
export function useInitialUnreadMessages(): void {
    const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
    const setUnreadCount = useMessageStore((s) => s.setUnreadCount);
    const reset = useMessageStore((s) => s.reset);

    useEffect(() => {
        if (!isAuthenticated) {
            // The whole inbox, not just the badge: the rows describe one
            // account too, and without this the next person to sign in on the
            // device opens the tab on the previous one's conversations.
            reset();
            return;
        }

        // Guards the sign-out case: an answer landing after this effect has
        // been torn down would repopulate what the branch above just cleared.
        let cancelled = false;

        messageApi
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
    }, [isAuthenticated, setUnreadCount, reset]);
}
