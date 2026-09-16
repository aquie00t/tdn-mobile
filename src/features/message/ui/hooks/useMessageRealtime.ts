import { useEffect } from "react";

import type { IncomingMessagePayload } from "../../data/message.types";
import { subscribeToRealtime } from "@core/realtime/useRealtimeSocket";
import { useMessageStore } from "../store/message.store";

/**
 * Whether a frame carries the payload these two events promise.
 *
 * The socket hands every frame over as `unknown` — it cannot type them, since
 * `core/` may not reach into a feature — so the narrowing belongs here. Every
 * field this version *writes into a row* is checked, and that is the line:
 * `messageId` and `senderId` go unread until the thread screen needs them, but
 * `createdAt` becomes a row's `lastMessageAt`, which the inbox hands to
 * `Intl.DateTimeFormat`. An unparseable one there is a `RangeError` thrown
 * during render, which takes the list down with it — so a date that will not
 * parse is dropped here, where the cost is one stale row.
 */
function isIncoming(payload: unknown): payload is IncomingMessagePayload {
    if (typeof payload !== "object" || payload === null) return false;

    const frame = payload as Partial<IncomingMessagePayload>;
    return (
        typeof frame.conversationId === "string" &&
        typeof frame.preview === "string" &&
        typeof frame.createdAt === "string" &&
        !Number.isNaN(Date.parse(frame.createdAt))
    );
}

/**
 * Turns the two arriving-message events into inbox state.
 *
 * The socket knows nothing about what its events mean, so this is the
 * messaging half of that arrangement — `useNotificationRealtime` is the other.
 * Direct messages ride the same connection rather than opening a second one,
 * which the API asks for explicitly.
 *
 * **`conversation:request` is not `message:new`.** They carry the same payload
 * and mean different things: a message opening a request must not raise the
 * unread badge, or an open inbox becomes a broadcast channel with a
 * notification attached to it. The store keeps them apart; this only routes
 * them.
 *
 * The other three chat events — `message:read`, `message:deleted`,
 * `message:media_rejected` — are all about a thread's contents, and land with
 * the thread screen.
 */
export function useMessageRealtime(): void {
    useEffect(
        () =>
            subscribeToRealtime((event, payload) => {
                if (event !== "message:new" && event !== "conversation:request")
                    return;
                if (!isIncoming(payload)) return;

                const store = useMessageStore.getState();

                if (event === "message:new") store.applyIncoming(payload);
                else store.applyRequest(payload);
            }),
        [],
    );
}
