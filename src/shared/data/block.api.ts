import { api } from "@core/api/client";
import type { BlockActionResponse, BlockedUser } from "./block.types";

/**
 * `GET /blocks` pages the way the follow lists do — `limit` from 1 to 50,
 * default 20 — and answers anything outside that with a 400, so the value is
 * clamped here rather than sent and rendered as an error.
 */
export const BLOCKED_LIST_MAX_LIMIT = 50;
export const BLOCKED_LIST_PAGE_SIZE = 20;

export interface BlockedListParams {
    limit?: number;
    offset?: number;
}

function blockedListQuery({
    limit = BLOCKED_LIST_PAGE_SIZE,
    offset = 0,
}: BlockedListParams): string {
    const query = new URLSearchParams();
    query.set(
        "limit",
        String(Math.min(Math.max(limit, 1), BLOCKED_LIST_MAX_LIMIT)),
    );
    query.set("offset", String(Math.max(offset, 0)));
    return query.toString();
}

/**
 * Blocking, in `shared/` because two features reach it: the profile header,
 * which blocks and unblocks, and Settings, which lists what is blocked — the
 * only way back to an account that is otherwise invisible everywhere.
 *
 * All three need a session and none is `isPublic`: there is nothing to read
 * anonymously, and a stale token should refresh rather than be replayed bare.
 * Blocking and unblocking share a SENSITIVE rate limit of five a minute.
 */
export const blockApi = {
    /**
     * Idempotent: blocking an account already blocked answers the same way.
     * The server also removes the follow in both directions, in the same
     * transaction — which is why the caller re-reads the profile instead of
     * patching one flag.
     */
    block: (targetId: string): Promise<BlockActionResponse> =>
        api.post<BlockActionResponse>("/blocks", { targetId }),

    /**
     * Idempotent the same way, and it lifts only *your* row: if the other
     * account blocked you independently, that block stands. The caller
     * re-reads rather than assuming both flags cleared.
     *
     * A `DELETE` with a body, sent with its header set by hand, exactly as
     * `followApi.unfollow` is.
     */
    unblock: (targetId: string): Promise<BlockActionResponse> =>
        api.delete<BlockActionResponse>("/blocks", {
            body: JSON.stringify({ targetId }),
            headers: { "Content-Type": "application/json" },
        }),

    /**
     * The accounts you have blocked, newest first. Only blocks you wrote —
     * there is deliberately no "who blocked me".
     */
    getBlocked: (params: BlockedListParams = {}): Promise<BlockedUser[]> =>
        api.get<BlockedUser[]>(`/blocks?${blockedListQuery(params)}`),
};
