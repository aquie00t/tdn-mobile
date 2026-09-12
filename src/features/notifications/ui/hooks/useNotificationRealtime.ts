import { useEffect } from "react";

import { subscribeToRealtime } from "@core/realtime/useRealtimeSocket";
import { useNotificationStore } from "../store/notification.store";

/**
 * Turns `new-notification` into a badge.
 *
 * The socket does not know what its events mean — it cannot, since `core/` may
 * not reach into a feature — so this is the notifications half of that
 * arrangement.
 *
 * One line of behaviour, and deliberately all of it: the payload is too thin
 * to become a row, so the count moves and the list does not. The list catches
 * up the next time it is read.
 */
export function useNotificationRealtime(): void {
    useEffect(
        () =>
            subscribeToRealtime((event) => {
                if (event === "new-notification") {
                    useNotificationStore.getState().incrementUnread();
                }
            }),
        [],
    );
}
