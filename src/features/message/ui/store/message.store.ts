import { create } from "zustand";

import type {
    Conversation,
    IncomingMessagePayload,
} from "../../data/message.types";

export interface MessageState {
    /** `ACCEPTED` threads, newest activity first. */
    conversations: Conversation[];
    conversationsCursor: string | null;
    /** `PENDING` threads — the request tab. */
    requests: Conversation[];
    requestsCursor: string | null;
    /**
     * How many requests are waiting **on the reader**. Derived from the
     * listing because the API offers no count for it: `/conversations/
     * unread-count` covers `ACCEPTED` only, deliberately, so that an
     * unanswered request cannot raise the inbox badge. That caps this at the
     * page size, which the tab label hides — anything past nine renders as
     * "9+".
     *
     * Counted from `isRequest` rather than from the length of the list. The
     * `?status=PENDING` listing holds both directions — a request somebody
     * sent the reader, and one the reader sent that has not been accepted —
     * and only the first is a decision waiting to be made.
     */
    requestCount: number;
    /**
     * Unread messages across `ACCEPTED` conversations. **The list never
     * defines this**, exactly as in `notification.store.ts`: counting loaded
     * rows would cap the badge at the page size, and recounting after an
     * appended page would wipe every realtime increment. The server answers it
     * directly.
     */
    unreadCount: number;

    /**
     * Bumped when realtime learned something the store cannot represent on its
     * own, and a mounted list should re-read from the server.
     *
     * The socket payload carries a `preview`, not a message. That is enough to
     * rewrite a row already on screen — its preview, its timestamp, its place
     * in the order — and nowhere near enough to build one that is not loaded.
     * Rather than inventing the missing half, the store says "you are behind"
     * and the hook that owns the request re-reads. Keeping the fetch out here
     * is what leaves every reducer below a pure function a test can drive.
     */
    conversationsRevision: number;
    requestsRevision: number;

    setConversations: (
        list: Conversation[],
        cursor: string | null,
        append?: boolean,
    ) => void;
    setRequests: (
        list: Conversation[],
        cursor: string | null,
        append?: boolean,
    ) => void;
    setUnreadCount: (count: number) => void;
    upsertConversation: (conversation: Conversation) => void;
    applyIncoming: (payload: IncomingMessagePayload) => void;
    applyRequest: (payload: IncomingMessagePayload) => void;
    reset: () => void;
}

/**
 * How many rows of a `PENDING` listing are the reader's to answer.
 *
 * The listing filters on participation and status, not on who opened the
 * thread, so it also carries the reader's own outgoing requests. Those have
 * nothing to decide — the server says so per row in `isRequest` — and counting
 * them would put a number on the tab for work that does not exist.
 */
const countRequests = (rows: Conversation[]): number =>
    rows.filter((c) => c.isRequest).length;

/**
 * Moves a conversation to the front and rewrites its preview from a realtime
 * payload. The list is ordered by last activity, so an arriving message
 * reorders it — which is also why the API offers no page numbers.
 */
function bumpRow(
    rows: Conversation[],
    payload: IncomingMessagePayload,
): { rows: Conversation[]; found: boolean } {
    const index = rows.findIndex((c) => c.id === payload.conversationId);
    if (index === -1) return { rows, found: false };

    const row = rows[index];
    const updated: Conversation = {
        ...row,
        lastMessagePreview: payload.preview,
        lastMessageAt: payload.createdAt,
        unreadCount: row.unreadCount + 1,
    };

    return {
        rows: [updated, ...rows.slice(0, index), ...rows.slice(index + 1)],
        found: true,
    };
}

/**
 * The inbox: two listings, two counts, and what realtime does to them.
 *
 * The thread is not here. It arrives with the thread screen, and with it the
 * one piece of state this version deliberately has no use for: the web keeps a
 * `focusedConversationId` so a message arriving in the thread somebody is
 * reading does not raise a badge they are about to clear. Nothing can be
 * focused while there is no thread screen, so the field would be a `null` that
 * every branch tests and nothing ever sets.
 *
 * Not persisted. Both counts describe a server-side fact, and a badge restored
 * from disk would be reporting a number from a session that has since been
 * read.
 */
export const useMessageStore = create<MessageState>((set) => ({
    conversations: [],
    conversationsCursor: null,
    requests: [],
    requestsCursor: null,
    requestCount: 0,
    unreadCount: 0,
    conversationsRevision: 0,
    requestsRevision: 0,

    setConversations: (list, cursor, append = false) =>
        set((state) => ({
            conversations: append ? [...state.conversations, ...list] : list,
            conversationsCursor: cursor,
        })),

    /**
     * The first page settles `requestCount`; an appended page adds to it. The
     * server is the authority either way, which is what corrects a count
     * realtime raised blind — a `conversation:request` arriving while no
     * request tab was mounted increments without a row to attach it to.
     */
    setRequests: (list, cursor, append = false) =>
        set((state) => ({
            requests: append ? [...state.requests, ...list] : list,
            requestsCursor: cursor,
            requestCount: append
                ? state.requestCount + countRequests(list)
                : countRequests(list),
        })),

    /** Authoritative: what the server last said the count was. */
    setUnreadCount: (count) => set({ unreadCount: count }),

    /**
     * After an accept or a decline.
     *
     * A thread that just left `PENDING` has to leave the request tab as well
     * as join the inbox, or it shows in both until the next fetch. A
     * `DECLINED` one leaves both lists: it is terminal and is never listed
     * again.
     */
    upsertConversation: (conversation) =>
        set((state) => {
            const conversations = state.conversations.filter(
                (c) => c.id !== conversation.id,
            );
            const requests = state.requests.filter(
                (c) => c.id !== conversation.id,
            );
            const isAccepted = conversation.status === "ACCEPTED";
            const isPending = conversation.status === "PENDING";

            return {
                conversations: isAccepted
                    ? [conversation, ...conversations]
                    : conversations,
                requests: isPending ? [conversation, ...requests] : requests,
                requestCount: countRequests(
                    isPending ? [conversation, ...requests] : requests,
                ),
            };
        }),

    applyIncoming: (payload) =>
        set((state) => {
            const { rows, found } = bumpRow(state.conversations, payload);

            return {
                conversations: rows,
                unreadCount: state.unreadCount + 1,
                // A message for a thread that is not in the loaded page leaves
                // nothing to reorder, so the list re-reads rather than growing
                // a row out of a payload that is not one.
                conversationsRevision: found
                    ? state.conversationsRevision
                    : state.conversationsRevision + 1,
            };
        }),

    /**
     * A message request. Distinct from `message:new` on purpose: it must not
     * raise the inbox badge, or an open inbox becomes a broadcast channel with
     * a notification attached to it.
     *
     * The event reaches the **recipient** of a pending conversation only, so a
     * payload for a thread this page does not hold is always a decision for
     * the reader and is counted as one.
     */
    applyRequest: (payload) =>
        set((state) => {
            const { rows, found } = bumpRow(state.requests, payload);

            return {
                requests: rows,
                requestCount: found
                    ? state.requestCount
                    : state.requestCount + 1,
                requestsRevision: found
                    ? state.requestsRevision
                    : state.requestsRevision + 1,
            };
        }),

    /**
     * Sign-out. Both counts and both listings describe one account, and
     * without this the next person to sign in on the device opens the inbox on
     * the previous one's rows.
     */
    reset: () =>
        set({
            conversations: [],
            conversationsCursor: null,
            requests: [],
            requestsCursor: null,
            requestCount: 0,
            unreadCount: 0,
        }),
}));
