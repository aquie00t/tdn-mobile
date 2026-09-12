/**
 * Where a tapped push notification leads.
 *
 * `notifications` is the answer for everything this payload cannot pin down,
 * and it is a real destination rather than a shrug: the list holds the same
 * notification with the fields the push had to leave out.
 */
export type PushTarget =
    | { kind: "post"; id: string }
    | { kind: "comment"; id: string }
    | { kind: "notifications" };

/** A JSON payload that crossed two wires; nothing in it is trustworthy. */
function id(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Decides what opens when somebody taps a notification on their lock screen.
 *
 * **This is not `notificationTarget`, and the difference is the payload.** A
 * row in the notifications list carries `referenceId` and the issuer's handle;
 * a push carries `{ type, postId?, commentId?, articleId?, articleSlug? }` and
 * nothing else, because the payload travels through Google's servers and the
 * one thing this platform promises not to hand over that way is content.
 * Ported rules that read `referenceId` or fall back to a profile would find
 * neither field here.
 *
 * So the ids decide, ordered most specific first — which is also what makes
 * `type` unread. Every type maps to whichever of its ids is present:
 *
 * - `commentId` — a comment, a reply, a like on one, or a mention in one. A
 *   comment on an article is read through the comment as well; the article
 *   fields arrive beside it and are deliberately ignored.
 * - `postId` — a like, a new post, a mention in a post, or a **quote**, where
 *   the id is the quote rather than the post that was quoted. The recipient
 *   wrote the original; what they want to see is what was said about it.
 * - the article fields — nothing to open. Articles are read on the web today,
 *   and sending somebody out of the app from their lock screen is worse than
 *   the list.
 * - nothing at all — a `FOLLOW`, whose payload is only a type. There is no
 *   handle in it to build a profile route from, and the list has one.
 *
 * `MEDIA_REJECTED` never arrives here: it is stored without a realtime emit,
 * and push hangs off the emit.
 *
 * @param data - The `data` map off the notification
 * @returns What to open
 */
export function pushTarget(data: Record<string, unknown>): PushTarget {
    const commentId = id(data.commentId);
    if (commentId) return { kind: "comment", id: commentId };

    const postId = id(data.postId);
    if (postId) return { kind: "post", id: postId };

    return { kind: "notifications" };
}
