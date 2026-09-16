import { api } from "@core/api/client";
import type { ApiResponse, CursorMeta } from "@core/api/api.types";
import type {
    Conversation,
    ConversationListStatus,
    Message,
    ThreadPage,
} from "./message.types";

/** The endpoint's default, and what the inbox asks for. */
export const CONVERSATION_PAGE_LIMIT = 20;

/** The thread endpoint's default. One screenful of history and some. */
export const THREAD_PAGE_LIMIT = 30;

interface CursorParams {
    limit?: number;
    cursor?: string | null;
}

/**
 * `cursor` is opaque — echoed back exactly as the server wrote it, never
 * parsed or built. It is omitted rather than sent empty on a first page: an
 * undecodable cursor is answered with the first page anyway, but sending one
 * the client invented is how that stops being true.
 */
function pageQuery(params: CursorParams, defaultLimit: number): string {
    const query = new URLSearchParams();
    query.set("limit", String(params.limit ?? defaultLimit));
    if (params.cursor) query.set("cursor", params.cursor);
    return query.toString();
}

/**
 * Direct messaging, inbox half.
 *
 * **Nothing here is `isPublic`.** There is no unauthenticated read path in this
 * feature at all, so a 401 can only mean the session is stale — it belongs to
 * the refresh, never to an anonymous replay.
 *
 * Writes are rate-limited at five a minute and reads at sixty, which is low
 * enough that a 429 is a reader-facing answer rather than an anomaly: someone
 * clearing a handful of requests in one sitting can reach it.
 */
export const messageApi = {
    /**
     * `ACCEPTED` backs the inbox, `PENDING` the request tab. `DECLINED` is
     * never listed, which is why the parameter cannot name it.
     *
     * `api.getPage`, not `api.get`: the cursor lives in `meta.nextCursor` and
     * unwrapping the envelope would throw it away.
     */
    getConversations: (
        status: ConversationListStatus,
        params: CursorParams = {},
    ): Promise<ApiResponse<Conversation[], CursorMeta>> =>
        api.getPage<Conversation[]>(
            `/conversations?status=${status}&${pageQuery(params, CONVERSATION_PAGE_LIMIT)}`,
        ),

    /**
     * Across `ACCEPTED` conversations only — an unanswered request never
     * raises the badge, which is what stops an open inbox being usable as a
     * broadcast channel with a notification attached. The request tab's own
     * count has no endpoint and is derived from its listing.
     */
    getUnreadCount: (): Promise<number> =>
        api
            .get<{ count: number }>("/conversations/unread-count")
            .then((data) => data.count),

    /**
     * Idempotent, which is why this is "open" rather than "create": a
     * conversation is identified by the pair, so the same two accounts always
     * resolve to the same thread. The API answers `201` when this request
     * opened it and `200` when one already existed — a distinction `apiClient`
     * does not surface, and does not need to, because everything that follows
     * is read off `isRequest` and `canSend` rather than off the status code.
     *
     * A declined pair comes back unchanged with `canSend: false`.
     */
    openConversation: (recipientId: string): Promise<Conversation> =>
        api.post<Conversation>("/conversations", { recipientId }),

    /**
     * Newest first; paging walks backwards through history. The first page
     * carries the conversation, so opening a thread costs one request.
     */
    getThread: (
        conversationId: string,
        params: CursorParams = {},
    ): Promise<ApiResponse<ThreadPage, CursorMeta>> =>
        api.getPage<ThreadPage>(
            `/conversations/${conversationId}/messages?${pageQuery(params, THREAD_PAGE_LIMIT)}`,
        ),

    /**
     * Both fields are optional to the server but not to each other — neither
     * text nor media is a `400 EmptyMessageError`. The composer refuses that
     * state rather than letting the request go.
     *
     * The key is the caller's, as everywhere else: it exists so that a
     * *person's* retry — tapping send again after a timeout — is answered from
     * the first attempt instead of posting the message twice. On a phone that
     * timeout is not hypothetical.
     */
    sendMessage: (
        conversationId: string,
        content: string,
        idempotencyKey: string,
        mediaUrls: string[] = [],
    ): Promise<Message> =>
        api.post<Message>(
            `/conversations/${conversationId}/messages`,
            { content, mediaUrls },
            { idempotencyKey },
        ),

    /**
     * Clears the caller's unread count and moves their read watermark; the
     * other participant is told over the socket.
     *
     * Reading a `PENDING` conversation emits no event, deliberately: opening
     * a request does not signal receipt to whoever sent it.
     */
    markRead: (conversationId: string): Promise<void> =>
        api.patch<void>(`/conversations/${conversationId}/read`, {}),

    /**
     * Withdraws a message. Only its sender may, and it is not reversible: the
     * stored text is blanked and any attachments are deleted from storage. The
     * row survives as a tombstone so a reply to it still has something to
     * answer.
     */
    deleteMessage: (messageId: string): Promise<void> =>
        api.delete(`/messages/${messageId}`, { contentType: false }),

    acceptConversation: (conversationId: string): Promise<Conversation> =>
        api.patch<Conversation>(`/conversations/${conversationId}/accept`, {}),

    /** Terminal. There is no reopen, which is why the UI confirms first. */
    declineConversation: (conversationId: string): Promise<Conversation> =>
        api.patch<Conversation>(`/conversations/${conversationId}/decline`, {}),
};
