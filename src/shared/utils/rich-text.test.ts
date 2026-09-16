import { describe, expect, it } from "vitest";

import { splitRichText } from "./rich-text";

describe("splitRichText", () => {
    it("carries each run's offset, so a renderer has a real key", () => {
        // Index keys are the easy answer and the wrong one; an offset is a
        // property of the text rather than of the loop.
        expect(splitRichText("a **b**").map((run) => run.start)).toEqual([
            0, 2,
        ]);
    });

    it("returns one plain run for a body with no markup", () => {
        expect(splitRichText("just words")).toEqual([
            { kind: "text", value: "just words", start: 0 },
        ]);
    });

    it("reads a bold run", () => {
        expect(splitRichText("a **b** c")).toEqual([
            { kind: "text", value: "a ", start: 0 },
            { kind: "bold", value: "b", start: 2 },
            { kind: "text", value: " c", start: 7 },
        ]);
    });

    it("keeps two bold runs apart", () => {
        // Non-greedy, or the middle of `**a** and **b**` is swallowed into one
        // run and the words between them go bold as well.
        expect(splitRichText("**a** and **b**")).toEqual([
            { kind: "bold", value: "a", start: 0 },
            { kind: "text", value: " and ", start: 5 },
            { kind: "bold", value: "b", start: 10 },
        ]);
    });

    it("leaves an unclosed marker alone", () => {
        expect(splitRichText("a ** b")).toEqual([
            { kind: "text", value: "a ** b", start: 0 },
        ]);
    });

    it("reads a link", () => {
        expect(splitRichText("see https://tdn.dev now")).toEqual([
            { kind: "text", value: "see ", start: 0 },
            { kind: "url", value: "https://tdn.dev", start: 4 },
            { kind: "text", value: " now", start: 19 },
        ]);
    });

    it("stops a link at whitespace", () => {
        expect(splitRichText("https://tdn.dev/a?b=1 x")[0]).toEqual({
            kind: "url",
            value: "https://tdn.dev/a?b=1",
            start: 0,
        });
    });

    it("takes bold and a link in one body", () => {
        expect(splitRichText("**hi** https://tdn.dev")).toEqual([
            { kind: "bold", value: "hi", start: 0 },
            { kind: "text", value: " ", start: 6 },
            { kind: "url", value: "https://tdn.dev", start: 7 },
        ]);
    });

    it("leaves a tag as text", () => {
        // Deliberate: a tag opens a feed filtered to it on the web and that
        // screen does not exist yet. A blue word that answers a tap with
        // nothing reads as broken; plain text reads as text.
        expect(splitRichText("#expo ships")).toEqual([
            { kind: "text", value: "#expo ships", start: 0 },
        ]);
    });

    describe("mentions", () => {
        const mentions = [{ id: "u1", username: "ada" }];

        it("leaves a handle as text when nothing resolved it", () => {
            // The body arrives unchanged and the API says separately which
            // handles name an account. Without that list there is nothing to
            // pair, and a link drawn anyway eventually points somebody's name
            // at a stranger.
            expect(splitRichText("hi @ada")).toEqual([
                { kind: "text", value: "hi @ada", start: 0 },
            ]);
        });

        it("links a handle the API resolved", () => {
            expect(splitRichText("hi @ada!", mentions)).toEqual([
                { kind: "text", value: "hi ", start: 0 },
                {
                    kind: "mention",
                    value: "ada",
                    username: "ada",
                    start: 3,
                },
                { kind: "text", value: "!", start: 7 },
            ]);
        });

        it("matches case-insensitively and keeps the casing that was typed", () => {
            // `@Ada` names the account `ada`; rewriting it to the stored
            // spelling would edit what somebody wrote.
            expect(splitRichText("@Ada", mentions)).toEqual([
                {
                    kind: "mention",
                    value: "Ada",
                    username: "ada",
                    start: 0,
                },
            ]);
        });

        it("links to the current handle after a rename", () => {
            // The relation is stored by id, so the API returns the account's
            // handle *now*. The text stays as it was written and the tap goes
            // where the account actually is.
            expect(
                splitRichText("@ada wrote it", [
                    { id: "u1", username: "ada.lovelace" },
                ]),
            ).toEqual([{ kind: "text", value: "@ada wrote it", start: 0 }]);
        });

        it("gives the trailing dot back to the sentence", () => {
            expect(splitRichText("ask @ada.", mentions)).toEqual([
                { kind: "text", value: "ask ", start: 0 },
                {
                    kind: "mention",
                    value: "ada",
                    username: "ada",
                    start: 4,
                },
                { kind: "text", value: ".", start: 8 },
            ]);
        });

        it("does not fire inside an email address", () => {
            // The character before the `@` is consumed to prove the handle
            // starts a word, and it comes back as text — so the body is one
            // run, exactly as if the branch had never matched.
            expect(splitRichText("write to ada@ada.dev", mentions)).toEqual([
                { kind: "text", value: "write to ada@ada.dev", start: 0 },
            ]);
        });

        it("takes two handles in one body", () => {
            expect(
                splitRichText("@ada and @bob", [
                    { id: "u1", username: "ada" },
                    { id: "u2", username: "bob" },
                ]),
            ).toEqual([
                {
                    kind: "mention",
                    value: "ada",
                    username: "ada",
                    start: 0,
                },
                { kind: "text", value: " and ", start: 4 },
                {
                    kind: "mention",
                    value: "bob",
                    username: "bob",
                    start: 9,
                },
            ]);
        });

        it("takes a handle beside the other markup", () => {
            expect(
                splitRichText("**hi** @ada https://tdn.dev", mentions),
            ).toEqual([
                { kind: "bold", value: "hi", start: 0 },
                { kind: "text", value: " ", start: 6 },
                {
                    kind: "mention",
                    value: "ada",
                    username: "ada",
                    start: 7,
                },
                { kind: "text", value: " ", start: 11 },
                { kind: "url", value: "https://tdn.dev", start: 12 },
            ]);
        });

        it("leaves a handle too short to be a username alone", () => {
            expect(splitRichText("@a", [{ id: "u1", username: "a" }])).toEqual([
                { kind: "text", value: "@a", start: 0 },
            ]);
        });
    });

    it("handles an empty body", () => {
        expect(splitRichText("")).toEqual([]);
    });
});
