import { describe, expect, it } from "vitest";

import { WEB_URL, buildPostUrl, postUrl } from "./post-url";

describe("postUrl", () => {
    it("points at the site, not the API", () => {
        // A shared link has to open something a person can read. The API's
        // origin would hand them a JSON document.
        expect(postUrl("p1")).toBe(`${WEB_URL}/post/p1`);
        expect(postUrl("p1")).not.toContain("/api/");
    });

    it("keeps the id verbatim", () => {
        const id = "018f3a2b-0000-7000-8000-000000000000";
        expect(postUrl(id)).toBe(`${WEB_URL}/post/${id}`);
    });
});

describe("buildPostUrl", () => {
    it.each([
        ["https://example.test", "https://example.test/post/p1"],
        ["https://example.test/", "https://example.test/post/p1"],
        ["https://example.test///", "https://example.test/post/p1"],
    ])("normalises %s", (origin, expected) => {
        expect(buildPostUrl(origin, "p1")).toBe(expected);
    });
});
