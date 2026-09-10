import { api } from "@core/api/client";
import type {
    Comment,
    CommentTarget,
    CreateCommentBody,
    GetCommentsParams,
} from "./comment.types";

/** What one page asks for. */
export const COMMENT_PAGE_LIMIT = 20;

/**
 * The collection a target owns. Only these two routes differ between posts and
 * articles; everything under `/comments/:id` is shared.
 */
const collectionPath = (target: CommentTarget): string =>
    target.type === "article"
        ? `/articles/${target.id}/comments`
        : `/posts/${target.id}/comments`;

function pageQuery(params: GetCommentsParams): string {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("limit", String(params.limit ?? COMMENT_PAGE_LIMIT));
    return query.toString();
}

export const commentApi = {
    /**
     * Posts a comment, or a reply when `parentId` is given.
     *
     * `parentId` is omitted rather than sent as `undefined`, which matters
     * because the API reads a present key as an intent: a top-level comment
     * carrying `parentId: null` is a different request from one that never
     * mentioned a parent.
     *
     * `idempotencyKey` is the caller's, and it has to be. This is one of the
     * eight routes that accept one, and it exists so a *person's* retry —
     * tapping "post" again after a timeout — is answered from the first
     * attempt. A key minted here would be fresh on every attempt and so no
     * better than none.
     */
    createComment: (
        target: CommentTarget,
        body: CreateCommentBody,
        idempotencyKey: string,
    ): Promise<Comment> =>
        api.post<Comment>(
            collectionPath(target),
            {
                content: body.content,
                mediaUrls: body.mediaUrls ?? [],
                ...(body.parentId ? { parentId: body.parentId } : {}),
            },
            { idempotencyKey },
        ),

    /**
     * One page of a target's comments, newest first.
     *
     * `isPublic` for the reason the feed uses it: a stale token on a readable
     * endpoint should show the comments, not an empty thread. The web passes
     * this per call because it has signed-out readers; here it is always true,
     * which is what the parameter would evaluate to anyway.
     */
    getComments: (
        target: CommentTarget,
        params: GetCommentsParams = {},
    ): Promise<Comment[]> =>
        api.get<Comment[]>(`${collectionPath(target)}?${pageQuery(params)}`, {
            isPublic: true,
        }),

    /*
     * Liking and saving a comment are the same four asymmetric routes a post
     * has — the verb changes and so does the last path segment. None takes an
     * idempotency key: they set a flag rather than create anything, so the
     * same request twice lands on the state the first one did.
     */
    likeComment: (commentId: string): Promise<void> =>
        api.post(`/comments/${commentId}/like`, {}),

    unlikeComment: (commentId: string): Promise<void> =>
        api.delete(`/comments/${commentId}/unlike`, { contentType: false }),

    saveComment: (commentId: string): Promise<void> =>
        api.post(`/comments/${commentId}/save`, {}),

    unsaveComment: (commentId: string): Promise<void> =>
        api.delete(`/comments/${commentId}/unsave`, { contentType: false }),

    /** One page of replies to a comment. */
    getReplies: (
        commentId: string,
        params: GetCommentsParams = {},
    ): Promise<Comment[]> =>
        api.get<Comment[]>(
            `/comments/${commentId}/replies?${pageQuery(params)}`,
            {
                isPublic: true,
            },
        ),
};
