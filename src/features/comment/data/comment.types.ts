export interface CommentAuthor {
    id: string;
    username: string;
    fullName?: string;
    /** NOT NULL server-side — the mapper substitutes a CDN default. */
    avatarUrl: string;
    isMe?: boolean;
}

/**
 * An account named in a comment's body, resolved by the API.
 *
 * Declared again here rather than reached for across features: a feature may
 * not import another feature, and `Mention` currently lives in the feed's
 * types. PR 24 brings the mention renderer and moves one copy to `shared/`,
 * which is the point at which having two stops being right.
 */
export interface Mention {
    id: string;
    username: string;
}

export interface Comment {
    id: string;
    content: string;
    mediaUrls: string[];
    /**
     * Content-level, not per-media: if any one attachment is judged sensitive
     * the whole item is flagged. There is no per-file flag.
     */
    isSensitive: boolean;
    /**
     * A video is stored before it is checked and hidden until it passes, so
     * `mediaUrls` arrives as `[]` while this is true.
     */
    mediaPending: boolean;
    createdAt: string;
    /** Always present; `[]` when the body names nobody. */
    mentions: Mention[];
    likeCount: number;
    replyCount: number;
    isLiked: boolean;
    isBookmarked: boolean;
    author: CommentAuthor;
    parentId: string | null;
    /**
     * A comment hangs off a post or an article, never both and never neither —
     * the database enforces exactly one of these being set. Narrow before use
     * rather than asserting with `!`.
     */
    postId: string | null;
    articleId: string | null;
}

/**
 * What a comment is attached to.
 *
 * The two live under different collection paths — `/posts/:id/comments`,
 * `/articles/:id/comments` — while every per-comment route under
 * `/comments/:id` is shared between them.
 */
export type CommentTarget =
    { type: "post"; id: string } | { type: "article"; id: string };

export interface CreateCommentBody {
    content: string;
    parentId?: string;
    mediaUrls?: string[];
}

export interface GetCommentsParams {
    page?: number;
    limit?: number;
}

/** The API's own cap on a comment body. Mirrored so its 400 is unreachable. */
export const COMMENT_MAX_LENGTH = 500;
