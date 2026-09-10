import { describe, expect, it } from "vitest";

import { appendNewOnly } from "./append-new-only";

const rows = (...ids: string[]) => ids.map((id) => ({ id }));

describe("appendNewOnly", () => {
    it("appends a page that shares nothing", () => {
        expect(appendNewOnly(rows("a", "b"), rows("c", "d"))).toEqual(
            rows("a", "b", "c", "d"),
        );
    });

    it("drops the overlap a head-grown list produces", () => {
        // The reader posted two comments after page 1 was read, so the server
        // shifted everything down by two and page 2 starts with the last two
        // rows of page 1. Without this they appear twice.
        expect(appendNewOnly(rows("a", "b", "c"), rows("b", "c", "d"))).toEqual(
            rows("a", "b", "c", "d"),
        );
    });

    it("keeps what is on screen when the whole page is a repeat", () => {
        expect(appendNewOnly(rows("a", "b"), rows("a", "b"))).toEqual(
            rows("a", "b"),
        );
    });

    it("does not reorder what is already there", () => {
        // The first page's order is the server's, and a duplicate arriving
        // later must not promote its row to the end of the list.
        expect(appendNewOnly(rows("c", "a", "b"), rows("a", "d"))).toEqual(
            rows("c", "a", "b", "d"),
        );
    });

    it("handles both sides being empty", () => {
        expect(appendNewOnly([], [])).toEqual([]);
        expect(appendNewOnly(rows("a"), [])).toEqual(rows("a"));
        expect(appendNewOnly([], rows("a"))).toEqual(rows("a"));
    });
});
