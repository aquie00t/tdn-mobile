import { useEffect } from "react";

import type {
    IncomingMessagePayload,
    MediaRejectedPayload,
    MessageDeletedPayload,
    MessageReadPayload,
} from "../../data/message.types";
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
 * Whether a frame carries a conversation and a message id.
 *
 * `message:deleted` and `message:media_rejected` share this shape. Both act on
 * a single row, so the id is the field that has to be there — one missing
 * would patch nothing and be indistinguishable from a message that was never
 * loaded.
 */
function isMessageEvent(
    payload: unknown,
): payload is MessageDeletedPayload | MediaRejectedPayload {
    if (typeof payload !== "object" || payload === null) return false;

    const frame = payload as Partial<MessageDeletedPayload>;
    return (
        typeof frame.conversationId === "string" &&
        typeof frame.messageId === "string"
    );
}

/**
 * Whether a frame carries a read watermark that a `Date` can be built from.
 *
 * `readAt` is compared against every outgoing message's `createdAt`, so an
 * unparseable one would quietly decide that nothing had been seen.
 */
function isRead(payload: unknown): payload is MessageReadPayload {
    if (typeof payload !== "object" || payload === null) return false;

    const frame = payload as Partial<MessageReadPayload>;
    return (
        typeof frame.conversationId === "string" &&
        typeof frame.readAt === "string" &&
        !Number.isNaN(Date.parse(frame.readAt))
    );
}

/**
 * Turns the five chat events into inbox and thread state.
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
 * The other three act on a thread's contents rather than on the listings, and
 * each is narrowed by what it writes rather than by its whole shape — see the
 * guards above. `message:media_rejected` reaches the sender only, which is why
 * nothing here checks who it is about: the server has already decided that.
 */
export function useMessageRealtime(): void {
    useEffect(
        () =>
            subscribeToRealtime((event, payload) => {
                const store = useMessageStore.getState();

                switch (event) {
                    case "message:new":
                        if (isIncoming(payload)) store.applyIncoming(payload);
                        return;

                    case "conversation:request":
                        if (isIncoming(payload)) store.applyRequest(payload);
                        return;

                    case "message:read":
                        if (isRead(payload)) store.applyRead(payload);
                        return;

                    case "message:deleted":
                        if (isMessageEvent(payload))
                            store.applyDeleted(payload);
                        return;

                    case "message:media_rejected":
                        if (isMessageEvent(payload))
                            store.applyMediaRejected(payload);
                        return;

                    default:
                        return;
                }
            }),
        [],
    );
}
