import { NetworkError } from "@core/api/api.types";
import type { ApiErrorResponse } from "@core/api/api.types";
import type { ArticleDraft } from "../domain/draft";
import { articleApi } from "./article.api";
import type {
    Article,
    CreateArticleBody,
    UpdateArticleBody,
} from "./article.types";
import type { PickedAsset } from "@shared/utils/asset-to-form";

/**
 * The cover as a save sees it.
 *
 * - `undefined` — leave whatever the article has.
 * - `null` — erase it.
 * - an object — this file, uploaded under this key.
 *
 * The file travels with its key so the editor can tell, once the save lands,
 * whether the cover it sent is still the one on screen — a writer can pick
 * another while a request is in flight.
 */
export type CoverChange =
    { asset: PickedAsset; key: string } | null | undefined;

const orNull = (value: string) => (value.trim() === "" ? null : value.trim());

/**
 * The first save of an article. Empty optional fields are left out rather
 * than sent as `""`, which the server would store as an empty excerpt.
 */
export function toCreateBody(
    draft: ArticleDraft,
    cover: CoverChange,
): CreateArticleBody {
    const body: CreateArticleBody = {
        title: draft.title.trim(),
        body: draft.body,
        tags: draft.tags,
        categories: draft.categories,
    };
    const excerpt = orNull(draft.excerpt);
    const coverAlt = orNull(draft.coverAlt);
    if (excerpt !== null) body.excerpt = excerpt;
    if (coverAlt !== null) body.coverImageAlt = coverAlt;
    if (cover) body.coverImageKey = cover.key;
    return body;
}

/**
 * Every later save. The whole form goes each time — the server takes a
 * partial body, but a diff would be one more thing to get wrong for a request
 * that is a few kilobytes either way.
 *
 * An emptied excerpt or description is sent as `null`, which erases it; the
 * cover key is sent only when the cover changed, because omitting it is the
 * only way to say "leave it".
 */
export function toUpdateBody(
    draft: ArticleDraft,
    cover: CoverChange,
): UpdateArticleBody {
    const body: UpdateArticleBody = {
        title: draft.title.trim(),
        body: draft.body,
        excerpt: orNull(draft.excerpt),
        coverImageAlt: orNull(draft.coverAlt),
        tags: draft.tags,
        categories: draft.categories,
    };
    if (cover !== undefined) body.coverImageKey = cover?.key ?? null;
    return body;
}

/**
 * Whether a failed create may have happened anyway.
 *
 * A timeout or a dropped connection can land after the server wrote the row,
 * and a 5xx says nothing either way. A 409 is the idempotency plugin reporting
 * that the first attempt under this key is *still running*. Any other answer
 * from the server is a refusal: nothing was created, and the plugin does not
 * remember a failure, so the key is free to go.
 */
export function isOutcomeUnknown(err: unknown): boolean {
    if (err instanceof NetworkError) return true;
    if (!err || typeof err !== "object") return false;
    const { status } = err as Partial<ApiErrorResponse>;
    return typeof status === "number" && (status >= 500 || status === 409);
}

export interface CreateAttempt {
    key: string;
    body: CreateArticleBody;
    /** The form as it stood when this body was built. */
    draft: ArticleDraft;
    cover: CoverChange;
}

export interface CreateResult {
    article: Article;
    /**
     * What actually reached the server — which, after a retry, is the first
     * attempt's form rather than the one on screen. The editor compares the
     * two to know whether the article still owes a `PATCH`.
     */
    sent: CreateAttempt;
}

/**
 * Creates an article at most once, however many times it is asked to.
 *
 * Autosave makes the create unusually exposed. It fires on a two-second pause
 * rather than on a tap, so a create that timed out is retried at the next
 * pause — and without a key, each of those is a second draft the writer never
 * asked for.
 *
 * A key alone is not enough, and this is the part that is easy to get wrong.
 * The server fingerprints the body and answers **409** when the same key
 * arrives with a different one — and by the retry the writer has typed on, so
 * the body *is* different. So the attempt is frozen whole: key, body and the
 * form it was built from. While its outcome is unknown, every retry sends
 * exactly that, and the server either answers from the first attempt or runs
 * it for the first time. Whatever was typed since is not lost; it is the
 * difference between `sent.draft` and the screen, and the editor sends it as
 * an ordinary update once the article exists.
 *
 * A refusal releases the attempt, because nothing was created and the next one
 * should carry what the writer has now.
 *
 * @param mintKey - Makes a fresh key; `newIdempotencyKey` in the app
 */
export function createArticleSender(mintKey: () => string) {
    let held: CreateAttempt | null = null;

    return {
        /** Whether a create is in doubt and the next send will repeat it. */
        isHolding: () => held !== null,

        /**
         * Sends the held attempt if there is one, or a new one built from
         * `draft` and `cover`.
         */
        async send(
            draft: ArticleDraft,
            cover: CoverChange,
        ): Promise<CreateResult> {
            const attempt: CreateAttempt = held ?? {
                key: mintKey(),
                body: toCreateBody(draft, cover),
                draft,
                cover,
            };
            held = attempt;

            try {
                const article = await articleApi.createArticle(
                    attempt.body,
                    attempt.key,
                );
                held = null;
                return { article, sent: attempt };
            } catch (err) {
                if (!isOutcomeUnknown(err)) held = null;
                throw err;
            }
        },
    };
}
