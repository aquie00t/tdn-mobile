import { api } from "@core/api/client";
import type { GetPostsParams, Post, PostType } from "./feed.types";

/** What one page asks for. The API caps it well above this. */
export const PAGE_LIMIT = 20;

export const feedApi = {
    /**
     * One page of the feed.
     *
     * `api.get`, **not** `api.getPage`. This endpoint is paged by
     * `page`/`limit` and answers a bare list; `getPage` returns the whole
     * `{ data, meta }` document and exists for the cursor-paginated listings
     * that keep a `nextCursor` in `meta`. Reaching for it here would hand the
     * caller an envelope where it expects posts.
     *
     * `isPublic` unless the request is narrowed to followed accounts, which is
     * the web's rule and worth keeping even though this client has no guest
     * browsing. It answers a different question: what a *stale* token should
     * do on a readable endpoint. Flagged public, a 401 replays the request
     * anonymously and refreshes in the background, so the feed still arrives.
     * A followed-only feed cannot be answered anonymously — there is nobody to
     * be following anyone — so it stays authenticated and a 401 means what it
     * says.
     *
     * @param params - Page, page size, and whatever narrows the feed
     * @returns The page, oldest field first as the API orders it
     */
    getPosts: (params: GetPostsParams = {}): Promise<Post[]> => {
        const query = new URLSearchParams();

        query.set("page", String(params.page ?? 1));
        query.set("limit", String(params.limit ?? PAGE_LIMIT));

        if (params.type) query.set("type", params.type);
        if (params.tag) query.set("tag", params.tag);

        // Only when true. Sending `followedOnly=false` would be read by the
        // API as a value rather than an absence, and it is also what decides
        // `isPublic` below — the two must not disagree.
        if (params.followedOnly) query.set("followedOnly", "true");

        // Repeated rather than joined: the API reads `categories` as a list,
        // and `categories=AI,GAME` is one category nobody has.
        if (params.categories?.length) {
            for (const category of params.categories) {
                query.append("categories", category);
            }
        }

        return api.get<Post[]>(`/posts?${query.toString()}`, {
            isPublic: !params.followedOnly,
        });
    },

    /**
     * One account's posts, newest first.
     *
     * Paged by number, like the feed — the profile's *follow* lists next to it
     * page by offset instead. The two endpoints simply differ, and writing one
     * as though it were the other is how a list starts skipping rows.
     *
     * Lives here rather than with the rest of the profile because it answers
     * posts: the type and the card that draw them are the feed's, and a
     * feature may not reach into another for either.
     */
    getUserPosts: (
        username: string,
        params: { page?: number; limit?: number } = {},
    ): Promise<Post[]> => {
        const query = new URLSearchParams();
        query.set("page", String(params.page ?? 1));
        query.set("limit", String(params.limit ?? PAGE_LIMIT));

        return api.get<Post[]>(`/users/${username}/posts?${query.toString()}`, {
            isPublic: true,
        });
    },

    /**
     * One post, re-read.
     *
     * Called while a video is being checked, and only for the post carrying
     * it. Re-reading the feed to learn about one attachment costs every other
     * row and, behind the 60 s server-side cache on the listing, usually hands
     * back the same stale copy it was asked about.
     */
    getPostById: (postId: string): Promise<Post> =>
        api.get<Post>(`/posts/${postId}`, { isPublic: true }),

    /**
     * Writes a post.
     *
     * `quotedPostId` is omitted rather than sent as `undefined`, so an
     * ordinary post posts exactly the body it used to and the server's rule —
     * empty content is allowed only on a quote — is never tripped by a key
     * that is present but empty. Nothing passes it yet; quoting is PR 12.
     *
     * `idempotencyKey` is the caller's. This is one of the eight routes that
     * accept one, and it is what closes the worst window in the flow above it:
     * once the media has uploaded, a create that times out leaves nobody able
     * to say whether the post exists. Retried under the same key, the API
     * answers from the first attempt instead of writing a second post — and
     * re-sending the same `mediaUrls` under a fresh key would be
     * `MediaNotOwnedError`, because an upload belongs to one piece of content.
     */
    createPost: (
        content: string,
        type: PostType,
        mediaUrls: string[],
        idempotencyKey: string,
        quotedPostId?: string,
    ): Promise<Post> =>
        api.post<Post>(
            "/posts",
            {
                content,
                type,
                mediaUrls,
                ...(quotedPostId ? { quotedPostId } : {}),
            },
            { idempotencyKey },
        ),

    /*
     * Liking and saving are four routes rather than two toggles, and the pairs
     * are **not** symmetric: the verb changes *and* so does the last path
     * segment — `like`/`unlike`, `save`/`unsave`. Writing `DELETE /like` is a
     * 404, which an optimistic caller shows as a heart that fills and empties
     * again a moment later, with no clue why.
     *
     * None of them takes an idempotency key, and none should. The eight routes
     * that accept one create something; these four set a flag, so sending the
     * same request twice lands on the same state the first one did.
     */
    likePost: (postId: string): Promise<void> =>
        api.post(`/posts/${postId}/like`, {}),

    unlikePost: (postId: string): Promise<void> =>
        api.delete(`/posts/${postId}/unlike`, { contentType: false }),

    savePost: (postId: string): Promise<void> =>
        api.post(`/posts/${postId}/save`, {}),

    unsavePost: (postId: string): Promise<void> =>
        api.delete(`/posts/${postId}/unsave`, { contentType: false }),
};
