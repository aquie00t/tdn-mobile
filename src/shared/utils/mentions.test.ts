import { describe, expect, it } from "vitest";

import {
    MAX_MENTIONS,
    extractHandles,
    findMention,
    insertMention,
    readActiveHandle,
    trimHandle,
} from "./mentions";

/**
 * These cases are the API's contract, not this file's preference. Every rule
 * and every negative example below is taken from `docs/mentions.md` in the API
 * repo, and they are the web client's cases carried across unchanged: the
 * client re-implements the server's grammar, and the only thing keeping the
 * three together is that they agree on the same examples.
 *
 * When the API changes the grammar, these fail — which is the point.
 */
describe("extractHandles", () => {
    it("reads a plain handle", () => {
        expect(extractHandles("good point @ada")).toEqual(["ada"]);
    });

    it("reads several", () => {
        expect(extractHandles("@ada and @bob thoughts?")).toEqual([
            "ada",
            "bob",
        ]);
    });

    it("allows dots and underscores inside a handle", () => {
        expect(extractHandles("@ada.b and @a_b_c")).toEqual(["ada.b", "a_b_c"]);
    });

    // "@ada." at the end of a sentence is the handle "ada"; "@ada.b" is not.
    it("treats a trailing dot or underscore as punctuation", () => {
        expect(extractHandles("thanks @ada.")).toEqual(["ada"]);
        expect(extractHandles("thanks @ada_")).toEqual(["ada"]);
        expect(extractHandles("see @ada.b")).toEqual(["ada.b"]);
    });

    it("keeps the casing that was written", () => {
        expect(extractHandles("@Ada")).toEqual(["Ada"]);
    });

    // The limit counts distinct accounts, not distinct spellings.
    it("counts a repeated handle once, case-insensitively", () => {
        expect(extractHandles("@ada @Ada @ADA")).toEqual(["ada"]);
    });

    describe("what is not a mention", () => {
        it.each([
            ["an email address", "ada@example.com"],
            ["a path", "docs/@v2"],
            ["a doubled marker", "@@here"],
        ])("ignores %s", (_name, content) => {
            expect(extractHandles(content)).toEqual([]);
        });

        it("ignores a handle shorter than the username minimum", () => {
            expect(extractHandles("@ab")).toEqual([]);
        });

        it("ignores a handle longer than the username maximum", () => {
            expect(extractHandles(`@${"a".repeat(31)}`)).toEqual([]);
        });

        it("ignores a bare at-sign", () => {
            expect(extractHandles("email me @ home")).toEqual([]);
        });
    });

    /*
     * A consumed prefix could in principle swallow the character that starts
     * the next match. It cannot here — every character the class excludes is
     * one that cannot begin a handle — and these hold that reasoning down.
     */
    describe("adjacent handles", () => {
        it("reads both across punctuation", () => {
            expect(extractHandles("@ada,@bob")).toEqual(["ada", "bob"]);
        });

        it("reads one at the very start of a body", () => {
            expect(extractHandles("@ada opened it")).toEqual(["ada"]);
        });

        it("still refuses the second when it is glued to the first", () => {
            expect(extractHandles("@ada@bob")).toEqual(["ada"]);
        });
    });

    it("does not stop at the limit — the caller decides", () => {
        const content = Array.from(
            { length: MAX_MENTIONS + 2 },
            (_, i) => `@user${i}`,
        ).join(" ");

        // Reading is not writing: a body over the limit still has to render,
        // and the composer is what refuses to send it.
        expect(extractHandles(content)).toHaveLength(MAX_MENTIONS + 2);
    });
});

describe("trimHandle", () => {
    it("removes only trailing punctuation", () => {
        expect(trimHandle("ada.")).toBe("ada");
        expect(trimHandle("ada__")).toBe("ada");
        expect(trimHandle("ada.b")).toBe("ada.b");
    });
});

describe("findMention", () => {
    const mentions = [
        { id: "u1", username: "ada" },
        { id: "u2", username: "bob.dev" },
    ];

    it("matches ignoring case, because @Ada names ada", () => {
        expect(findMention("Ada", mentions)?.id).toBe("u1");
    });

    it("matches a handle carrying a dot", () => {
        expect(findMention("bob.dev", mentions)?.id).toBe("u2");
    });

    /*
     * The three that must behave the same: a typo, a deleted account, and one
     * renamed since the body was written. The last cannot be paired at all.
     */
    it("finds nothing for a handle that is not in the list", () => {
        expect(findMention("carol", mentions)).toBeUndefined();
    });

    it("finds nothing when the body names someone but the list is empty", () => {
        expect(findMention("ada", [])).toBeUndefined();
        expect(findMention("ada", undefined)).toBeUndefined();
    });
});

/** Read with the caret at the end, which is where somebody typing has it. */
const at = (text: string) => readActiveHandle(text, text.length);

/**
 * The caret reader, which decides whether a suggestion list opens at all. It
 * has to agree with the grammar above about what an `@` starts.
 */
describe("readActiveHandle", () => {
    it("opens on a bare @", () => {
        expect(at("hello @")).toEqual({ start: 6, query: "" });
    });

    it("reads what has been typed so far", () => {
        expect(at("hello @ad")).toEqual({ start: 6, query: "ad" });
    });

    it("opens at the very start of a body", () => {
        expect(at("@ad")).toEqual({ start: 0, query: "ad" });
    });

    it.each([
        ["inside an email address", "ada@exa"],
        ["inside a path", "docs/@v"],
        ["after a doubled marker", "@@he"],
    ])("stays shut %s", (_name, text) => {
        expect(at(text)).toBeNull();
    });

    it("stays shut once a space has ended the handle", () => {
        expect(at("hi @ada ")).toBeNull();
    });

    describe("where the caret is", () => {
        it("ignores what comes after it", () => {
            expect(readActiveHandle("@ada and @bob", 4)).toEqual({
                start: 0,
                query: "ada",
            });
        });

        it("finds the handle the caret is actually in", () => {
            const text = "@ada and @bo";
            expect(readActiveHandle(text, text.length)).toEqual({
                start: 9,
                query: "bo",
            });
        });

        it("is null when the caret sits before any @", () => {
            expect(readActiveHandle("hi @ada", 2)).toBeNull();
        });
    });
});

describe("insertMention", () => {
    it("writes the account over the handle and a space after it", () => {
        const text = "thanks @ad";
        const active = readActiveHandle(text, text.length)!;

        expect(insertMention(text, active, "ada")).toEqual({
            text: "thanks @ada ",
            caret: 12,
        });
    });

    it("keeps what follows the caret", () => {
        const text = "@ad and more";
        const active = readActiveHandle(text, 3)!;

        expect(insertMention(text, active, "ada.b")).toEqual({
            text: "@ada.b  and more",
            caret: 7,
        });
    });

    it("replaces the rest of the handle the caret sits inside", () => {
        // A caret dropped into the middle of a finished handle — the typo
        // being corrected. `query` stops at the caret, so replacing only that
        // much would strand the tail: `@adele mm what's up`.
        const text = "@adamm what's up";
        const active = readActiveHandle(text, 4)!;

        expect(active).toEqual({ start: 0, query: "ada" });
        expect(insertMention(text, active, "adele")).toEqual({
            text: "@adele  what's up",
            caret: 7,
        });
    });

    it("stops replacing at the character that ends a handle", () => {
        // Only the handle's own character set is swallowed, so the word after
        // it survives even with no space between them.
        const text = "@ad-ok";
        const active = readActiveHandle(text, 3)!;

        expect(insertMention(text, active, "ada")).toEqual({
            text: "@ada -ok",
            caret: 5,
        });
    });
});
