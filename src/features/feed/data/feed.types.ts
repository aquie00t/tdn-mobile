export type PostType =
    "COMMUNITY" | "TECH_NEWS" | "SYSTEM_UPDATE" | "JOB_POSTING";

export type PostCategory = "AI" | "GAME" | "MOBILE" | "BACKEND" | "FRONTEND";

export interface PostAuthor {
    id: string;
    username: string;
    fullName?: string;
    /** NOT NULL server-side — the mapper substitutes a CDN default. */
    avatarUrl: string;
    isMe?: boolean;
}

export interface PostTag {
    name: string;
}

/**
 * An account named in a post's body, resolved by the API.
 *
 * Lives here rather than in `shared/` because nothing else has needed it yet.
 * PR 24 brings the mention resolver — the thing that turns `@ada` in a body
 * into a link — and moves this beside it.
 */
export interface Mention {
    id: string;
    username: string;
}

/**
 * The post carried inside a quote.
 *
 * Deliberately not a `Post`. The API sends a trimmed shape here: no counters,
 * no `isLiked`/`isBookmarked`, and — this is the load-bearing part — no
 * `quotedPost` of its own. Quoting a quote is allowed, but the embedded card
 * is always exactly one level deep, so nothing here can recurse.
 */
export interface QuotedPost {
    id: string;
    content: string;
    mediaUrls: string[];
    createdAt: string;
    author: PostAuthor;
    /**
     * Both are content-level, not per-media: if any one attachment is judged
     * sensitive the whole item is flagged and all of its media is blurred.
     * There is no per-file flag to be more precise with.
     */
    isSensitive: boolean;
    /**
     * A video is stored before it is checked and hidden until it passes, so
     * `mediaUrls` arrives as `[]` while this is true. That is not an item
     * without media — it is media that cannot be shown yet.
     */
    mediaPending: boolean;
}

export interface Post {
    id: string;
    content: string;
    type: PostType;
    mediaUrls: string[];
    createdAt: string;
    likeCount: number;
    commentCount: number;
    /** How many times this post has been quoted. Server-maintained. */
    quoteCount: number;
    isLiked: boolean;
    isBookmarked: boolean;
    author: PostAuthor;
    tags?: PostTag[];
    /** Always present; `[]` when the body names nobody. */
    mentions: Mention[];
    /**
     * `null` on an ordinary post. A quote is not a separate entity — it is a
     * post that happens to carry another one — so every list, action and route
     * that already handles posts handles quotes with no special case.
     */
    quotedPost: QuotedPost | null;
    /** Content-level, as on {@link QuotedPost}. */
    isSensitive: boolean;
    /** Content-level, as on {@link QuotedPost}. */
    mediaPending: boolean;
}

export interface GetPostsParams {
    page?: number;
    limit?: number;
    type?: PostType;
    tag?: string;
    followedOnly?: boolean;
    categories?: PostCategory[];
}
