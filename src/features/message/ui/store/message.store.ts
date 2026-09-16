import { create } from "zustand";

import type {
    Conversation,
    IncomingMessagePayload,
    Message,
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
     * The thread the reader is looking at **right now** — not merely one that
     * is mounted.
     *
     * A message arriving into a thread somebody is reading is read on arrival,
     * so it must not raise the badge they are about to clear; the same message
     * arriving in a thread left open behind a backgrounded app has been read
     * by nobody and must.
     */
    focusedConversationId: string | null;
    activeConversation: Conversation | null;
    /** Newest first, as the API returns them. */
    messages: Message[];
    messagesCursor: string | null;

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
    threadRevision: number;

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

    setFocusedConversation: (id: string | null) => void;
    setThread: (
        conversation: Conversation,
        messages: Message[],
        cursor: string | null,
        append?: boolean,
    ) => void;
    clearThread: () => void;
    addMessage: (message: Message) => void;
    replaceMessage: (tempId: string, message: Message) => void;
    removeMessage: (id: string) => void;
    markMessageDeleted: (id: string) => void;
    markConversationRead: (id: string) => void;

    reset: () => void;
}

function patchMessage(
    messages: Message[],
    id: string,
    patch: Partial<Message>,
): Message[] {
    return messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
}

/** What a withdrawal leaves behind: the row, and nothing in it. */
const TOMBSTONE: Partial<Message> = {
    isDeleted: true,
    content: "",
    mediaUrls: [],
    mediaPending: false,
};

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
    countsAsUnread = true,
): { rows: Conversation[]; found: boolean } {
    const index = rows.findIndex((c) => c.id === payload.conversationId);
    if (index === -1) return { rows, found: false };

    const row = rows[index];
    const updated: Conversation = {
        ...row,
        lastMessagePreview: payload.preview,
        lastMessageAt: payload.createdAt,
        unreadCount: countsAsUnread ? row.unreadCount + 1 : row.unreadCount,
    };

    return {
        rows: [updated, ...rows.slice(0, index), ...rows.slice(index + 1)],
        found: true,
    };
}

/**
 * Messaging: two listings, two counts, one open thread, and what realtime does
 * to all of them.
 *
 * Not persisted. The counts describe a server-side fact, and a badge restored
 * from disk would be reporting a number from a session that has since been
 * read; the thread is a screen's worth of state and is re-read when it opens.
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
    threadRevision: 0,
    focusedConversationId: null,
    activeConversation: null,
    messages: [],
    messagesCursor: null,

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
     *
     * **And the open thread is patched too**, when it is this one. Everything
     * the thread screen draws — the request banner, the composer, the closed
     * notice — is read off `activeConversation`, so leaving it behind would
     * mean accepting a request and still being offered the decision, with no
     * composer, until the screen was left and opened again.
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
                activeConversation:
                    state.activeConversation?.id === conversation.id
                        ? conversation
                        : state.activeConversation,
            };
        }),

    applyIncoming: (payload) =>
        set((state) => {
            const isFocused =
                state.focusedConversationId === payload.conversationId;
            const { rows, found } = bumpRow(
                state.conversations,
                payload,
                !isFocused,
            );

            return {
                conversations: rows,
                /*
                 * A thread the reader is looking at is read as it arrives, so
                 * raising the badge for it would leave a number they can only
                 * clear by navigating away and coming back.
                 */
                unreadCount: isFocused
                    ? state.unreadCount
                    : state.unreadCount + 1,
                /*
                 * The bubble cannot be built from a preview, so the open
                 * thread re-reads its newest page instead.
                 */
                threadRevision: isFocused
                    ? state.threadRevision + 1
                    : state.threadRevision,
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

    setFocusedConversation: (id) => set({ focusedConversationId: id }),

    setThread: (conversation, messages, cursor, append = false) =>
        set((state) => ({
            activeConversation: conversation,
            // Older pages arrive after the newest ones and the array runs
            // newest first, so an appended page belongs at the end.
            messages: append ? [...state.messages, ...messages] : messages,
            messagesCursor: cursor,
        })),

    clearThread: () =>
        set({
            activeConversation: null,
            messages: [],
            messagesCursor: null,
            focusedConversationId: null,
        }),

    addMessage: (message) =>
        set((state) => ({ messages: [message, ...state.messages] })),

    /**
     * Swaps an optimistic bubble for the server's copy.
     *
     * The fallbacks are the interesting part. A thread re-reads its newest
     * page whenever realtime says it is behind, and that replaces `messages`
     * wholesale — so a send that was in flight at that moment comes back to
     * find its `temp-` row gone. Dropping the answer there would hide a
     * message that *was* sent until the screen was reopened, and the obvious
     * response to a message that never appeared is to send it again.
     *
     * So: swap it where the placeholder still is, ignore it where the refetch
     * already brought it back, and otherwise put it at the front, which for a
     * newest-first array is where a message just sent belongs.
     */
    replaceMessage: (tempId, message) =>
        set((state) => {
            if (state.messages.some((m) => m.id === tempId)) {
                return {
                    messages: state.messages.map((m) =>
                        m.id === tempId ? message : m,
                    ),
                };
            }

            if (state.messages.some((m) => m.id === message.id)) return {};

            return { messages: [message, ...state.messages] };
        }),

    removeMessage: (id) =>
        set((state) => ({
            messages: state.messages.filter((m) => m.id !== id),
        })),

    /**
     * A withdrawal empties the row without removing it. Dropping it outright
     * would close a gap the other participant may have replied into, leaving
     * their reply answering nothing.
     */
    markMessageDeleted: (id) =>
        set((state) => ({
            messages: patchMessage(state.messages, id, TOMBSTONE),
        })),

    /**
     * Zeroes the row for immediate feedback. The global count is deliberately
     * **not** adjusted here — the caller re-reads it from the server, because
     * a thread that was never in a loaded page has no `unreadCount` to
     * subtract and guessing one leaves the badge permanently wrong in a
     * direction nothing corrects.
     */
    markConversationRead: (id) =>
        set((state) => ({
            conversations: state.conversations.map((c) =>
                c.id === id ? { ...c, unreadCount: 0 } : c,
            ),
            activeConversation:
                state.activeConversation?.id === id
                    ? { ...state.activeConversation, unreadCount: 0 }
                    : state.activeConversation,
        })),

    /**
     * Sign-out. Every listing, count and open thread describes one account,
     * and without this the next person to sign in on the device opens the
     * inbox on the previous one's rows.
     */
    reset: () =>
        set({
            conversations: [],
            conversationsCursor: null,
            requests: [],
            requestsCursor: null,
            requestCount: 0,
            unreadCount: 0,
            activeConversation: null,
            messages: [],
            messagesCursor: null,
            focusedConversationId: null,
        }),
}));
