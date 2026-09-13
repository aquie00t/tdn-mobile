/**
 * Whether a post or a comment was written by the person reading it.
 *
 * `isMe` is the server's word and is used when it is there; the author id
 * against the session is the fallback, because not every listing the cards are
 * drawn from sends the flag. Either one saying yes is enough.
 *
 * It decides which control a card carries: you report what is not yours and
 * never what is — the API refuses a report of your own content with a 400, so
 * the card decides rather than offering it and being refused.
 *
 * @param author - The content's author, as the card has it
 * @param viewerId - The signed-in account's id, if there is one
 */
export function isOwnContent(
    author: { id: string; isMe?: boolean },
    viewerId: string | null | undefined,
): boolean {
    if (author.isMe === true) return true;
    return Boolean(viewerId) && author.id === viewerId;
}
