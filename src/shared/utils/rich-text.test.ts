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

    it("leaves tags and handles as text", () => {
        // Deliberate: a tag opens a filtered feed on the web and a mention
        // opens a profile, and neither screen exists yet. Four blue words that
        // answer a tap with nothing read as broken; plain text reads as text.
        expect(splitRichText("#expo and @ada")).toEqual([
            { kind: "text", value: "#expo and @ada", start: 0 },
        ]);
    });

    it("handles an empty body", () => {
        expect(splitRichText("")).toEqual([]);
    });
});
