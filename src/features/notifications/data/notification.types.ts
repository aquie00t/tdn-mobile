/**
 * Mirrors the API's enum exactly.
 *
 * `COMMENT_REPLY` was missing from the web's copy for long enough to ship a
 * crash: the message map is a `Record<NotificationType, …>`, so a value absent
 * from this union is also absent from that map without TypeScript noticing,
 * and the card then translated `undefined`.
 */
export type NotificationType =
    | "FOLLOW"
    | "NEW_POST"
    | "LIKE"
    | "COMMENT"
    | "COMMENT_LIKE"
    | "COMMENT_REPLY"
    | "QUOTE"
    | "MENTION"
    | "MEDIA_REJECTED";

export interface Notification {
    recipientId: string;
    /**
     * On a `MEDIA_REJECTED` this equals `recipientId`, and `username` and
     * `avatarUrl` are the recipient's own. The notice comes from the platform,
     * which has no account to attribute it to — read as an issuer it says the
     * reader did this to themselves, so that type ignores all three.
     */
    issuerId: string;
    username: string;
    type: NotificationType;
    avatarUrl: string;
    /** The most specific target: the comment, else the article, else the post. */
    referenceId: string | null;
    /**
     * Present on the types that have somewhere to go. `MEDIA_REJECTED` fills
     * them in four combinations — a post; a post and a comment; a comment,
     * article and slug; or none of them, when a video was uploaded and the
     * post was never sent.
     *
     * `articleId` and `articleSlug` are not read for a *comment*: a comment on
     * an article is still reached through the comment, and that is the right
     * place to land — the media was taken off the comment, not off the top of
     * the article.
     */
    postId?: string | null;
    commentId?: string | null;
    articleId?: string | null;
    articleSlug?: string | null;
    createdAt: string;
    isRead: boolean;
}

/**
 * What the socket sends on `new-notification`.
 *
 * Deliberately thinner than a `Notification` and **not convertible to one** —
 * no `username`, no `avatarUrl`, no `createdAt`. That is why the badge is a
 * count the server owns rather than something derived from the list: an
 * increment that arrives here cannot be turned into a row to be counted back.
 */
export interface RealtimeNotificationPayload {
    type: NotificationType;
    issuerId: string;
    /**
     * On a `QUOTE` this is the quote, not the post that was quoted — the
     * recipient wrote the original and wants to see what was said about it.
     */
    postId?: string;
    referenceId?: string;
}
