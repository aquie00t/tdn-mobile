import type { CategoryValue } from "@shared/constants/categories";
import { MAX_MENTIONS, extractHandles } from "@shared/utils/mentions";

/**
 * Field limits the server enforces.
 *
 * A violation comes back as a bare 400 reading "Invalid data format provided."
 * with no field named, and an oversized request as a 413 naming nothing at
 * all — so every one of these is checked here, or the writer is told only
 * that something went wrong.
 */
export const ARTICLE_LIMITS = {
    titleMax: 160,
    bodyMax: 100_000,
    excerptMax: 300,
    coverAltMax: 160,
    tagsMax: 5,
    categoriesMax: 5,
    /** The whole request body, not just the markdown. */
    requestBytesMax: 256 * 1024,
    coverBytesMax: 5 * 1024 * 1024,
} as const;

/**
 * What the writer is holding: the form, not the article.
 *
 * Every field is a plain value the screen can bind to — an empty excerpt is
 * `""` rather than `null` — and the translation into what the API wants,
 * where `null` and absent mean different things, happens once, at the edge,
 * in `data/article-save.ts`.
 */
export interface ArticleDraft {
    title: string;
    body: string;
    excerpt: string;
    coverAlt: string;
    tags: string[];
    categories: CategoryValue[];
}

export const EMPTY_DRAFT: ArticleDraft = {
    title: "",
    body: "",
    excerpt: "",
    coverAlt: "",
    tags: [],
    categories: [],
};

/** Why a draft cannot be sent, or `null` when it can. */
export type DraftProblem =
    "empty" | "titleTooLong" | "bodyTooLong" | "tooLarge" | "tooManyMentions";

/**
 * Whether a draft can be sent, and if not, the one reason to name.
 *
 * Autosave is gated on this as well as the publish button, and that matters
 * more than it looks: a body naming eleven people would otherwise retry a
 * request the server refuses every two seconds for as long as the editor
 * stayed open.
 *
 * **Characters are not bytes.** A body inside the character limit can still
 * breach the request cap once it carries Turkish letters or emoji — each is
 * two to four bytes in UTF-8 — and that arrives as a 413 rather than a
 * validation error. `serialised` is taken rather than computed because the
 * caller already has it for its dirty check, and stringifying a hundred
 * thousand characters twice a keystroke is not free.
 *
 * @param draft - What the writer holds
 * @param serialised - `JSON.stringify(draft)`, which the caller already made
 * @returns The problem to show, or `null` when the draft may be sent
 */
export function checkDraft(
    draft: ArticleDraft,
    serialised: string,
): DraftProblem | null {
    if (draft.title.trim() === "" || draft.body.trim() === "") return "empty";
    if (draft.title.length > ARTICLE_LIMITS.titleMax) return "titleTooLong";
    if (draft.body.length > ARTICLE_LIMITS.bodyMax) return "bodyTooLong";
    if (extractHandles(draft.body).length > MAX_MENTIONS) {
        return "tooManyMentions";
    }
    if (
        new TextEncoder().encode(serialised).length >
        ARTICLE_LIMITS.requestBytesMax
    ) {
        return "tooLarge";
    }
    return null;
}

/**
 * Whether the writer has put anything at all into the form.
 *
 * An untouched new article is "unsaved" in the narrow sense — the server has
 * nothing — but leaving it loses nothing, and asking "discard your changes?"
 * about a blank page teaches people to press through the question.
 */
export function isBlankDraft(draft: ArticleDraft): boolean {
    return (
        draft.title.trim() === "" &&
        draft.body.trim() === "" &&
        draft.excerpt.trim() === "" &&
        draft.coverAlt.trim() === "" &&
        draft.tags.length === 0 &&
        draft.categories.length === 0
    );
}
