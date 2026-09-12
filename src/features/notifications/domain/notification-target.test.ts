import { describe, expect, it } from "vitest";

import type { NotificationLike } from "./notification-target";
import { notificationTarget } from "./notification-target";

/**
 * Shaped like the row the API sends, minus the fields these rules never read —
 * which is the point of `NotificationLike`.
 */
const row = (
    type: string,
    fields: Partial<NotificationLike> = {},
): NotificationLike => ({
    username: "ada",
    type,
    referenceId: null,
    ...fields,
});

describe("notificationTarget", () => {
    it("sends a follow to the profile", () => {
        expect(notificationTarget(row("FOLLOW"))).toEqual({
            kind: "profile",
            username: "ada",
        });
    });

    it.each(["NEW_POST", "LIKE", "QUOTE"] as const)(
        "sends %s to the post in referenceId",
        (type) => {
            expect(
                notificationTarget(row(type, { referenceId: "p1" })),
            ).toEqual({ kind: "post", id: "p1" });
        },
    );

    it("sends a quote to the quote, not to the quoted post", () => {
        // `referenceId` on a QUOTE is the quote itself. The recipient wrote the
        // original; sending them there is sending them nowhere.
        expect(
            notificationTarget(
                row("QUOTE", { referenceId: "quote-1", postId: "original-1" }),
            ),
        ).toEqual({ kind: "post", id: "quote-1" });
    });

    it.each(["COMMENT", "COMMENT_LIKE", "COMMENT_REPLY"] as const)(
        "sends %s to the comment",
        (type) => {
            expect(
                notificationTarget(row(type, { referenceId: "c1" })),
            ).toEqual({ kind: "comment", id: "c1" });
        },
    );

    it("falls back to the profile when a reference is missing", () => {
        expect(notificationTarget(row("LIKE"))).toEqual({
            kind: "profile",
            username: "ada",
        });
    });

    describe("a mention", () => {
        it("goes to the comment when it names one", () => {
            // Not `referenceId`: being named in a comment means the comment,
            // being named in a post means the post, and one field cannot serve
            // both.
            expect(
                notificationTarget(
                    row("MENTION", { commentId: "c1", postId: "p1" }),
                ),
            ).toEqual({ kind: "comment", id: "c1" });
        });

        it("goes to the post when there is no comment", () => {
            expect(
                notificationTarget(row("MENTION", { postId: "p1" })),
            ).toEqual({ kind: "post", id: "p1" });
        });

        it("falls back to the profile with neither", () => {
            expect(notificationTarget(row("MENTION"))).toEqual({
                kind: "profile",
                username: "ada",
            });
        });
    });

    describe("a media rejection", () => {
        it("opens the comment the media was taken off", () => {
            expect(
                notificationTarget(
                    row("MEDIA_REJECTED", { commentId: "c1", postId: "p1" }),
                ),
            ).toEqual({ kind: "comment", id: "c1" });
        });

        it("opens the post when only a post is named", () => {
            expect(
                notificationTarget(row("MEDIA_REJECTED", { postId: "p1" })),
            ).toEqual({ kind: "post", id: "p1" });
        });

        it("leads nowhere when the post was never sent", () => {
            // And specifically not to a profile: `username` on this type is
            // the *recipient's* own, so that fallback sends somebody to
            // themselves to be told off.
            expect(notificationTarget(row("MEDIA_REJECTED"))).toEqual({
                kind: "none",
            });
        });
    });

    it("falls back to the profile for a type this build has never heard of", () => {
        // The API owns the enum and may grow it. A row this build cannot read
        // should still do something rather than become a dead one.
        expect(notificationTarget(row("SOMETHING_NEW"))).toEqual({
            kind: "profile",
            username: "ada",
        });
    });
});
