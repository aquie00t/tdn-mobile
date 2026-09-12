/**
 * What the rules below actually read.
 *
 * Declared here rather than imported: `domain/` may not reach into `data/`,
 * and these rules do not need the whole row — a `Notification` satisfies this
 * shape structurally, so the caller passes one unchanged.
 */
export interface NotificationLike {
    type: string;
    username: string;
    referenceId?: string | null;
    postId?: string | null;
    commentId?: string | null;
}

/**
 * Where a notification leads.
 *
 * Kept as a value rather than a call to a router, so the rules can be read and
 * tested without a navigator — and there are more rules here than anywhere
 * else in the app.
 */
export type NotificationTarget =
    | { kind: "post"; id: string }
    | { kind: "comment"; id: string }
    | { kind: "profile"; username: string }
    /** A platform notice about media that was removed, with nothing to open. */
    | { kind: "none" };

/**
 * Decides what opens when a notification is pressed.
 *
 * Every branch here is a mistake somebody already made:
 *
 * **A `QUOTE`'s `referenceId` is the quote, not the quoted post.** The
 * recipient wrote the original; what they want to see is what was said about
 * it. Sending them to their own post is sending them nowhere.
 *
 * **A `MENTION` cannot use `referenceId`.** Being named in a post means the
 * post, being named in a comment means the comment, and one field cannot serve
 * both — the presence of `commentId` is what says which.
 *
 * **A `MEDIA_REJECTED` has four shapes**: a post; a post and a comment; a
 * comment on an article; or nothing at all, when the video was uploaded and
 * the post was never sent. The last one has to be `none` rather than a guess.
 * Its `username` and `avatarUrl` are the *recipient's* own, so falling back to
 * a profile would send somebody to themselves to be told off.
 *
 * **An unknown type falls back to the issuer's profile.** The API owns the
 * enum and may grow it; a row this build cannot read should still do
 * something rather than become a dead one.
 *
 * @param notification - The row that was pressed
 * @returns What to open
 */
export function notificationTarget(
    notification: NotificationLike,
): NotificationTarget {
    const { type, referenceId, postId, commentId, username } = notification;

    if (type === "MEDIA_REJECTED") {
        if (commentId) return { kind: "comment", id: commentId };
        if (postId) return { kind: "post", id: postId };
        return { kind: "none" };
    }

    switch (type) {
        case "FOLLOW":
            return { kind: "profile", username };

        case "NEW_POST":
        case "LIKE":
        case "QUOTE":
            return referenceId
                ? { kind: "post", id: referenceId }
                : { kind: "profile", username };

        case "COMMENT":
        case "COMMENT_LIKE":
        case "COMMENT_REPLY":
            return referenceId
                ? { kind: "comment", id: referenceId }
                : { kind: "profile", username };

        case "MENTION": {
            if (commentId) return { kind: "comment", id: commentId };
            if (postId) return { kind: "post", id: postId };
            return { kind: "profile", username };
        }

        default:
            return { kind: "profile", username };
    }
}
