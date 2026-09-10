import { api } from "@core/api/client";
import type { GetPostsParams, Post } from "./feed.types";

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
     * One post, re-read.
     *
     * Called while a video is being checked, and only for the post carrying
     * it. Re-reading the feed to learn about one attachment costs every other
     * row and, behind the 60 s server-side cache on the listing, usually hands
     * back the same stale copy it was asked about.
     */
    getPostById: (postId: string): Promise<Post> =>
        api.get<Post>(`/posts/${postId}`, { isPublic: true }),
};
