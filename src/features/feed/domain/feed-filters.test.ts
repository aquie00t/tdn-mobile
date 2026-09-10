import { describe, expect, it } from "vitest";

import { feedIdentity } from "./feed-filters";

const base = {
    type: "COMMUNITY" as const,
    followedOnly: false,
    categories: [],
};

describe("feedIdentity", () => {
    it("changes with the tab", () => {
        expect(feedIdentity(base)).not.toBe(
            feedIdentity({ ...base, type: "TECH_NEWS" }),
        );
    });

    it("changes with the followed-only flag", () => {
        // Not a filter over what came back: the endpoint answers a different
        // set, and the flag also decides whether the request is public.
        expect(feedIdentity(base)).not.toBe(
            feedIdentity({ ...base, followedOnly: true }),
        );
    });

    it("changes with the categories", () => {
        expect(feedIdentity(base)).not.toBe(
            feedIdentity({ ...base, categories: ["AI"] }),
        );
    });

    it("does not change when the same categories are chosen in another order", () => {
        // The API matches a post against *any* of them, so the two ask the
        // same question — and without the sort the reader pays for a round
        // trip that lands on the list already in front of them.
        expect(feedIdentity({ ...base, categories: ["AI", "GAME"] })).toBe(
            feedIdentity({ ...base, categories: ["GAME", "AI"] }),
        );
    });

    it("tells one category from two", () => {
        expect(feedIdentity({ ...base, categories: ["AI"] })).not.toBe(
            feedIdentity({ ...base, categories: ["AI", "GAME"] }),
        );
    });

    it("does not mutate the list it was given", () => {
        const categories = ["GAME", "AI"] as const;
        const input = [...categories];

        feedIdentity({ ...base, categories: input });

        expect(input).toEqual(["GAME", "AI"]);
    });
});
