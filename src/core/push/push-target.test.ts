import { describe, expect, it } from "vitest";

import { pushTarget } from "./push-target";

describe("pushTarget", () => {
    it("opens the comment when the payload names one", () => {
        expect(
            pushTarget({ type: "COMMENT", postId: "p1", commentId: "c1" }),
        ).toEqual({ kind: "comment", id: "c1" });
    });

    it("opens the comment for a like on a comment", () => {
        // `COMMENT_LIKE` carries both ids, and the comment is the specific
        // one. The post is where the comment lives, not what happened.
        expect(
            pushTarget({ type: "COMMENT_LIKE", commentId: "c1", postId: "p1" }),
        ).toEqual({ kind: "comment", id: "c1" });
    });

    it("opens the post for a like", () => {
        expect(pushTarget({ type: "LIKE", postId: "p1" })).toEqual({
            kind: "post",
            id: "p1",
        });
    });

    it("opens the quote rather than the post that was quoted", () => {
        // The API fills `postId` with the quote for this type. There is no
        // second id in the payload, so this passes by construction — the test
        // is here to pin the contract the API side documents.
        expect(pushTarget({ type: "QUOTE", postId: "quote-1" })).toEqual({
            kind: "post",
            id: "quote-1",
        });
    });

    it("opens the comment a mention is in, not the post around it", () => {
        expect(
            pushTarget({ type: "MENTION", commentId: "c1", postId: "p1" }),
        ).toEqual({ kind: "comment", id: "c1" });
    });

    it("falls back to the list for a follow, which names nothing", () => {
        // A `FOLLOW` payload is a type and nothing else — no handle to build a
        // profile route from. The list carries one.
        expect(pushTarget({ type: "FOLLOW" })).toEqual({
            kind: "notifications",
        });
    });

    it("falls back to the list for an article, which has no screen here", () => {
        expect(
            pushTarget({
                type: "LIKE",
                articleId: "a1",
                articleSlug: "hello-world",
            }),
        ).toEqual({ kind: "notifications" });
    });

    it("falls back to the list for a type this build has never heard of", () => {
        expect(pushTarget({ type: "SOMETHING_NEW" })).toEqual({
            kind: "notifications",
        });
    });

    it("ignores ids that are not strings", () => {
        // Two wires and a JSON round trip sit between the server and this
        // function. `/post/[object Object]` is the failure it prevents.
        expect(pushTarget({ type: "LIKE", postId: 12 })).toEqual({
            kind: "notifications",
        });
        expect(pushTarget({ type: "COMMENT", commentId: "" })).toEqual({
            kind: "notifications",
        });
        expect(pushTarget({})).toEqual({ kind: "notifications" });
    });
});
