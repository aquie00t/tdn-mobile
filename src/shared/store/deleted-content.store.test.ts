import { beforeEach, describe, expect, it } from "vitest";

import { isPostGone, useDeletedContentStore } from "./deleted-content.store";

beforeEach(() => {
    useDeletedContentStore.setState({ posts: {}, comments: {} });
});

describe("useDeletedContentStore", () => {
    it("marks and unmarks a post", () => {
        useDeletedContentStore.getState().markPost("p1");
        expect(useDeletedContentStore.getState().posts).toEqual({ p1: true });

        useDeletedContentStore.getState().unmarkPost("p1");
        expect(useDeletedContentStore.getState().posts).toEqual({});
    });

    it("keeps posts and comments apart", () => {
        // A post and a comment can share nothing but a coincidence of ids,
        // and a rollback of one must not bring back the other.
        useDeletedContentStore.getState().markPost("x");
        useDeletedContentStore.getState().markComment("x");
        useDeletedContentStore.getState().unmarkComment("x");

        expect(useDeletedContentStore.getState().posts).toEqual({ x: true });
        expect(useDeletedContentStore.getState().comments).toEqual({});
    });
});

describe("isPostGone", () => {
    it("is true for a deleted post", () => {
        expect(isPostGone({ id: "p1" }, { p1: true })).toBe(true);
    });

    it("is true for a quote of a deleted post", () => {
        // The server cascades a delete to every quote of the post.
        expect(
            isPostGone({ id: "q1", quotedPost: { id: "p1" } }, { p1: true }),
        ).toBe(true);
    });

    it("is false for anything else", () => {
        expect(
            isPostGone({ id: "q1", quotedPost: { id: "p2" } }, { p1: true }),
        ).toBe(false);
        expect(isPostGone({ id: "p3", quotedPost: null }, { p1: true })).toBe(
            false,
        );
    });
});
