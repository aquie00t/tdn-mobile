/** What the server accepts for a tag. It normalises too, but rejects first. */
export const TAG_PATTERN = /^[a-z0-9-]{1,30}$/;

/**
 * Folds what the writer typed into what the server will accept.
 *
 * The server lowercases and trims anyway, so doing it here only makes the chip
 * on screen match what will be stored. Spaces become hyphens because "clean
 * architecture" is the obvious thing to type and `clean-architecture` is the
 * only way to say it.
 *
 * Turkish letters are transliterated rather than dropped: `yazılım` quietly
 * becoming `yazlm` would be worse than either refusing it or turning it into
 * `yazilim`. The capital `İ` is replaced before lowercasing, because
 * `"İ".toLowerCase()` is `i` plus a combining dot — two code points, the
 * second of which would then be stripped, leaving the right letter by accident
 * rather than by design. Anything still outside the pattern is removed,
 * because a rejected tag comes back as a bare 400 that never names the field.
 *
 * @param raw - What was typed
 * @returns The tag as it will be stored; `""` when nothing survives
 */
export function normaliseTag(raw: string): string {
    return raw
        .trim()
        .replace(/İ/g, "i")
        .toLowerCase()
        .replace(/ı/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 30);
}

export function isValidTag(tag: string): boolean {
    return TAG_PATTERN.test(tag);
}

/**
 * The tag list after the writer commits what they typed — or the same list,
 * by reference, when there is nothing to add.
 *
 * A duplicate, an empty result and a full list all leave it unchanged rather
 * than throwing: each is somebody pressing return on something that simply
 * does not become a chip, and the hint under the field already says why.
 *
 * @param tags - The tags already chosen
 * @param raw - What was typed
 * @param max - The server's cap
 */
export function addTag(tags: string[], raw: string, max: number): string[] {
    const tag = normaliseTag(raw);
    if (!isValidTag(tag) || tags.includes(tag) || tags.length >= max) {
        return tags;
    }
    return [...tags, tag];
}
