import { describe, expect, it } from "vitest";

import { isOwnContent } from "./is-own-content";

describe("isOwnContent", () => {
    it("takes the server's word when it is given", () => {
        expect(isOwnContent({ id: "u1", isMe: true }, "someone-else")).toBe(
            true,
        );
    });

    it("falls back to the author against the session", () => {
        expect(isOwnContent({ id: "u1" }, "u1")).toBe(true);
        expect(isOwnContent({ id: "u1", isMe: false }, "u1")).toBe(true);
    });

    it("is somebody else's otherwise", () => {
        expect(isOwnContent({ id: "u1" }, "u2")).toBe(false);
    });

    it("is never yours when nobody is signed in", () => {
        // An empty id must not match an author whose id is also missing.
        expect(isOwnContent({ id: "" }, "")).toBe(false);
        expect(isOwnContent({ id: "u1" }, null)).toBe(false);
    });
});
