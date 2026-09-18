import { describe, expect, it } from "vitest";

import { ARTICLE_LIMITS, EMPTY_DRAFT, checkDraft, isBlankDraft } from "./draft";
import type { ArticleDraft } from "./draft";

const draftWith = (changes: Partial<ArticleDraft>): ArticleDraft => ({
    ...EMPTY_DRAFT,
    title: "A title",
    body: "Some body",
    ...changes,
});

const check = (draft: ArticleDraft) => checkDraft(draft, JSON.stringify(draft));

describe("checkDraft", () => {
    it("lets an ordinary draft through", () => {
        expect(check(draftWith({}))).toBeNull();
    });

    it("needs both a title and a body, whitespace not counting", () => {
        expect(check(draftWith({ title: "   " }))).toBe("empty");
        expect(check(draftWith({ body: "\n\n" }))).toBe("empty");
    });

    it("names the title when it is over its cap", () => {
        const title = "x".repeat(ARTICLE_LIMITS.titleMax + 1);
        expect(check(draftWith({ title }))).toBe("titleTooLong");
    });

    it("names the body when it is over its cap", () => {
        const body = "x".repeat(ARTICLE_LIMITS.bodyMax + 1);
        expect(check(draftWith({ body }))).toBe("bodyTooLong");
    });

    it("refuses a body naming more accounts than the API accepts", () => {
        // The server counts handles *written*, before resolving any, so
        // eleven made-up names are as refused as eleven real ones.
        const body = Array.from({ length: 11 }, (_, i) => `@user${i}`).join(
            " ",
        );
        expect(check(draftWith({ body }))).toBe("tooManyMentions");
    });

    it("counts bytes rather than characters against the request cap", () => {
        // 90,000 characters is inside the body cap, but `€` is three bytes
        // in UTF-8, so the request is 270 KB — over the 256 KB cap that
        // arrives as a bare 413.
        const body = "€".repeat(90_000);
        expect(body.length).toBeLessThan(ARTICLE_LIMITS.bodyMax);
        expect(check(draftWith({ body }))).toBe("tooLarge");
    });

    it("does not mistake the same length in ASCII for too large", () => {
        const body = "g".repeat(90_000);
        expect(check(draftWith({ body }))).toBeNull();
    });
});

describe("isBlankDraft", () => {
    it("calls an untouched form blank, whitespace included", () => {
        expect(isBlankDraft(EMPTY_DRAFT)).toBe(true);
        expect(isBlankDraft({ ...EMPTY_DRAFT, body: "  \n" })).toBe(true);
    });

    it("counts a body with no title as writing to lose", () => {
        // The case leaving has to ask about: nothing can be saved without a
        // title, and the body is somebody's work.
        expect(isBlankDraft({ ...EMPTY_DRAFT, body: "Half an essay" })).toBe(
            false,
        );
        expect(isBlankDraft({ ...EMPTY_DRAFT, tags: ["go"] })).toBe(false);
    });
});
