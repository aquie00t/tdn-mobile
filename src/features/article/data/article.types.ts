import type { Mention } from "@shared/utils/mentions";

/**
 * Mirrors `PostCategory` — the API uses one category enum for posts and
 * articles alike. Kept as its own union so this feature does not depend on the
 * feed's types for a value the server owns, which a feature may not do anyway.
 */
export type ArticleCategory = "AI" | "GAME" | "MOBILE" | "BACKEND" | "FRONTEND";

export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface ArticleAuthor {
    id: string;
    username: string;
    fullName?: string;
    /** NOT NULL server-side — the mapper substitutes a CDN default. */
    avatarUrl: string;
    isMe?: boolean;
}

export interface ArticleTag {
    name: string;
}

/**
 * What the list endpoint returns: every article field except `body`.
 *
 * The omission is deliberate on the server — a body runs to 100,000
 * characters, so a page of twenty would be megabytes of markdown. Cards render
 * `excerpt`; reaching for `body` here yields `undefined`, not a short string.
 *
 * **`id` and `slug` both matter and are not interchangeable**: reading takes
 * the `slug`, while like, bookmark and comment all take the `id`.
 */
export interface ArticleSummary {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    coverImageUrl: string | null;
    coverImageAlt: string | null;
    /**
     * The cover only, and there is no `mediaPending` beside it: a cover is
     * always an image, and images are checked inside the upload request rather
     * than after it, so a cover is never waiting.
     */
    isSensitive: boolean;
    readingTimeMinutes: number;
    likeCount: number;
    commentCount: number;
    isLiked: boolean;
    isBookmarked: boolean;
    status: ArticleStatus;
    publishedAt: string | null;
    createdAt: string;
    author: ArticleAuthor;
    tags: ArticleTag[];
    /** Always present; `[]` when the body names nobody. */
    mentions: Mention[];
    categories: ArticleCategory[];
}

/** What `GET /articles/:slug` returns — a summary plus the raw markdown. */
export interface Article extends ArticleSummary {
    body: string;
}

export interface GetArticlesParams {
    page?: number;
    /** The endpoint caps this at 50. */
    limit?: number;
    tag?: string;
    authorUsername?: string;
    categories?: ArticleCategory[];
    followedOnly?: boolean;
}

/**
 * What `POST /articles` takes. It always creates a **draft**; nothing is
 * readable by anybody else until `POST /articles/:id/publish` runs.
 *
 * Validation failures come back as a bare 400 naming no field, so every limit
 * is mirrored in `domain/draft.ts` and checked before this is sent.
 */
export interface CreateArticleBody {
    title: string;
    body: string;
    excerpt?: string;
    coverImageKey?: string;
    coverImageAlt?: string;
    tags?: string[];
    categories?: ArticleCategory[];
}

/**
 * What `PATCH /articles/:id` takes.
 *
 * **`null` and `undefined` mean different things here.** An omitted field is
 * left alone; `null` on one of the three nullable ones erases it. Collapsing
 * the two would make removing a cover impossible.
 */
export interface UpdateArticleBody {
    title?: string;
    body?: string;
    excerpt?: string | null;
    coverImageKey?: string | null;
    coverImageAlt?: string | null;
    tags?: string[];
    categories?: ArticleCategory[];
}

/**
 * What `POST /articles/cover` answers. The **key** is what an article carries;
 * the URL is only for showing the image before the article is saved.
 */
export interface CoverUploadResponse {
    coverImageKey: string;
    coverImageUrl: string;
}
