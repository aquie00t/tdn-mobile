import { describe, expect, it } from "vitest";

import { assertList } from "./assert-list";

describe("assertList", () => {
    it("passes a list through", () => {
        expect(() => assertList([])).not.toThrow();
        expect(() => assertList([1, 2, 3])).not.toThrow();
    });

    it.each([
        ["null", null],
        ["an object", { data: [] }],
        ["a string", "posts"],
        ["undefined", undefined],
    ])("throws on %s", (_label, value) => {
        // The type says this cannot happen; a proxy, an outage or a mis-shaped
        // handler says otherwise, and the whole point is to find out here
        // rather than at the next render.
        expect(() => assertList(value as unknown as unknown[])).toThrow(
            "Expected a list from the API.",
        );
    });
});
