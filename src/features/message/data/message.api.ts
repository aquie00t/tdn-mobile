import { api } from "@core/api/client";
import type { ApiResponse, CursorMeta } from "@core/api/api.types";
import type { Conversation, ConversationListStatus } from "./message.types";

/** The endpoint's default, and what the inbox asks for. */
export const CONVERSATION_PAGE_LIMIT = 20;

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

    acceptConversation: (conversationId: string): Promise<Conversation> =>
        api.patch<Conversation>(`/conversations/${conversationId}/accept`, {}),

    /** Terminal. There is no reopen, which is why the UI confirms first. */
    declineConversation: (conversationId: string): Promise<Conversation> =>
        api.patch<Conversation>(`/conversations/${conversationId}/decline`, {}),
};
