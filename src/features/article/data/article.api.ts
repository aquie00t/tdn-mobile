import { api } from "@core/api/client";
import type {
    Article,
    ArticleSummary,
    CoverUploadResponse,
    CreateArticleBody,
    GetArticlesParams,
    UpdateArticleBody,
} from "./article.types";
import { assetToFormPart } from "@shared/utils/asset-to-form";
import type { PickedAsset } from "@shared/utils/asset-to-form";
import { withModerationRetry } from "@shared/utils/media-errors";

/** One screenful and some, the same page size the feed asks for. */
export const ARTICLE_PAGE_LIMIT = 20;

/**
 * Reading articles.
 *
 * **Paged by `page`/`limit`, not by a cursor** — so `api.get`, never
 * `api.getPage`. The listing answers a bare array and keeps nothing in `meta`
 * worth having; `getPage` is for the cursor endpoints, and using it here would
 * hand back an envelope whose `nextCursor` is always null.
 *
 * Note the un-like and un-bookmark paths: an article answers
 * `DELETE /articles/:id/like`, where a post answers
 * `DELETE /posts/:id/unlike`. Copying `feedApi` verbatim produces a 404 on
 * every undo.
 */
export const articleApi = {
    getArticles: (
        params: GetArticlesParams = {},
    ): Promise<ArticleSummary[]> => {
        const query = new URLSearchParams();
        query.set("page", String(params.page ?? 1));
        query.set("limit", String(params.limit ?? ARTICLE_PAGE_LIMIT));
        if (params.tag) query.set("tag", params.tag);
        if (params.authorUsername) {
            query.set("authorUsername", params.authorUsername);
        }
        if (params.followedOnly) query.set("followedOnly", "true");
        params.categories?.forEach((category) => {
            query.append("categories", category);
        });

        /*
         * `followedOnly` is the one cut that needs to know who is asking, so
         * it is the one that is not public. The rest is readable with a stale
         * token — which is what `isPublic` governs: not whether a guest may
         * read, but what happens to an expired session on a readable path.
         */
        return api.get<ArticleSummary[]>(`/articles?${query.toString()}`, {
            isPublic: !params.followedOnly,
        });
    },

    /**
     * Read by **slug**, not id.
     *
     * A draft belonging to somebody else answers `404` rather than `403`, so a
     * failure here is an ordinary not-found and never a "this exists but is
     * unpublished" — the same reasoning the message endpoints use for a thread
     * the caller is not in.
     */
    getArticleBySlug: (slug: string): Promise<Article> =>
        api.get<Article>(`/articles/${encodeURIComponent(slug)}`, {
            isPublic: true,
        }),

    likeArticle: (articleId: string): Promise<void> =>
        api.post(`/articles/${articleId}/like`, {}),

    unlikeArticle: (articleId: string): Promise<void> =>
        api.delete(`/articles/${articleId}/like`, { contentType: false }),

    bookmarkArticle: (articleId: string): Promise<void> =>
        api.post(`/articles/${articleId}/bookmark`, {}),

    unbookmarkArticle: (articleId: string): Promise<void> =>
        api.delete(`/articles/${articleId}/bookmark`, { contentType: false }),

    /**
     * Creates a **draft**. Nothing is readable by anybody else until
     * `publishArticle` runs.
     *
     * One of the eight routes that take an `Idempotency-Key`, and the key is
     * the caller's — see `createArticleSender`, which also owns the rule that
     * makes one safe to reuse: the server fingerprints the body, and the same
     * key arriving with different text is a 409.
     */
    createArticle: (
        body: CreateArticleBody,
        idempotencyKey: string,
    ): Promise<Article> =>
        api.post<Article>("/articles", body, { idempotencyKey }),

    updateArticle: (
        articleId: string,
        body: UpdateArticleBody,
    ): Promise<Article> => api.patch<Article>(`/articles/${articleId}`, body),

    publishArticle: (articleId: string): Promise<Article> =>
        api.post<Article>(`/articles/${articleId}/publish`, {}),

    archiveArticle: (articleId: string): Promise<Article> =>
        api.post<Article>(`/articles/${articleId}/archive`, {}),

    deleteArticle: (articleId: string): Promise<void> =>
        api.delete(`/articles/${articleId}`, { contentType: false }),

    /**
     * Uploads a cover and answers the key the article will carry.
     *
     * **Its own channel**, not `/media`: a key from here is only good as a
     * `coverImageKey`, and nothing from `/media` is. Exactly one file, under
     * any field name. Five a minute, so the caller uploads once per chosen
     * image and reuses the key for every later save — see `useArticleEditor`.
     *
     * `withModerationRetry` absorbs one 503 from the moderation provider, as
     * every other upload does.
     */
    uploadCover: (asset: PickedAsset): Promise<CoverUploadResponse> =>
        withModerationRetry(() => {
            const form = new FormData();
            form.append("file", assetToFormPart(asset, 0) as unknown as Blob);

            return api.post<CoverUploadResponse>("/articles/cover", form, {
                contentType: false,
            });
        }),
};
