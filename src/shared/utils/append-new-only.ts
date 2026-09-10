/** Anything with an id — a comment, or a reply, which is also a comment. */
interface Identified {
    id: string;
}

/**
 * Appends a page while dropping anything already on screen.
 *
 * These endpoints page by a page *number*, and the lists they feed grow at the
 * head: posting a comment — or a post — puts it on top immediately. That shifts every server
 * row down by one, so page 2 comes back overlapping page 1 by exactly the
 * number of comments added since page 1 was read — and without this, the
 * reader sees the last few comments of the first page repeated under it.
 *
 * Matching on id is the whole fix. The alternative is cursor pagination, which
 * is an API change rather than a client one.
 *
 * @param previous - What is on screen
 * @param incoming - The page that just arrived
 * @returns The two joined, with duplicates dropped from the incoming half
 */
export function appendNewOnly<T extends Identified>(
    previous: T[],
    incoming: T[],
): T[] {
    const seen = new Set(previous.map((item) => item.id));
    return [...previous, ...incoming.filter((item) => !seen.has(item.id))];
}
