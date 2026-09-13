import { api } from "@core/api/client";

/** The endpoint's ceiling. */
export const BOOKMARKS_MAX_LIMIT = 100;

/** What one page of saved things holds, per kind. */
export const BOOKMARKS_PAGE_SIZE = 20;

/**
 * One page of everything saved, and the reason this file is generic.
 *
 * The endpoint answers posts, comments and articles in a single document, so
 * whoever calls it has to know all three types — and those types belong to
 * three different features, which may not import one another. Nothing here
 * names them: the shape is stated once, and the screen that renders the three
 * lists supplies the types it already has.
 *
 * The alternative was a second declaration of what a post and a comment are,
 * living in `shared/` where neither of them belongs — two models of the same
 * thing, drifting from the day they were written.
 */
export interface BookmarksPage<TPost, TComment, TArticle = unknown> {
    posts: TPost[];
    comments: TComment[];
    /**
     * Optional because it arrived in a later API version than the other two,
     * so a server that has not been updated answers without the field at all.
     * The web's hook carries the same `?? []`.
     */
    articles?: TArticle[];
}

export interface BookmarksParams {
    page?: number;
    limit?: number;
}

export const bookmarksApi = {
    /**
     * The reader's own saved posts, comments and articles.
     *
     * **Not `isPublic`.** A saved list is nobody's but its owner's, and the
     * endpoint authenticates: a request without a token has no meaning here,
     * and a stale one should be renewed rather than replayed anonymously.
     *
     * All three kinds are paged together by one page number — there is no
     * per-kind cursor — which is what makes a caller's "is there more" a
     * question about each list rather than about the request.
     */
    getBookmarks: <TPost, TComment, TArticle = unknown>({
        page = 1,
        limit = BOOKMARKS_PAGE_SIZE,
    }: BookmarksParams = {}): Promise<
        BookmarksPage<TPost, TComment, TArticle>
    > => {
        const query = new URLSearchParams({
            page: String(Math.max(page, 1)),
            // Clamped rather than sent: the schema answers an over-large limit
            // with a 400, and a list that renders an error instead of what was
            // saved is worse than a shorter page.
            limit: String(Math.min(Math.max(limit, 1), BOOKMARKS_MAX_LIMIT)),
        });

        return api.get<BookmarksPage<TPost, TComment, TArticle>>(
            `/posts/bookmarks?${query.toString()}`,
        );
    },
};
