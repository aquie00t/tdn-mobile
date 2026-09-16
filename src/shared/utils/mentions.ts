import { AUTH_LIMITS } from "../data/account-rules";

/**
 * An account named in a body, as the API resolved it.
 *
 * Resolution happens once, at write time, and is stored as a relation to the
 * account rather than as the text that was typed — so `username` is the
 * account's **current** handle and may differ from what the body says if it
 * has since been renamed.
 *
 * Shared rather than declared per feature: posts and comments both carry this
 * and it belongs to neither. It used to be declared twice, once in each.
 */
export interface Mention {
    id: string;
    username: string;
}

/** Most distinct handles one body may name, past which the API answers 400. */
export const MAX_MENTIONS = 10;

/**
 * Matches an `@handle` in a body. **This grammar mirrors the API's**
 * (`extract-mentions.ts`) and has to keep mirroring it: the API returns the
 * body unchanged and says separately which handles are real, so pairing the
 * two is the client's job. Drift is silent — a link that never appears, or one
 * that points somewhere it should not. Ported from the web client verbatim.
 *
 * The leading group is what stops this firing on a string that merely contains
 * an at-sign: an email (`ada@example.com`), a path (`docs/@v2`), a doubled
 * marker (`@@here`). The API expresses that as a lookbehind; this consumes the
 * character instead, which behaves identically here — every character the
 * class excludes is one that cannot begin a handle, so no overlapping match is
 * lost. The renderer puts the consumed character back as text.
 *
 * Length is checked after the match rather than in the pattern, because a
 * trailing dot has to be trimmed as punctuation first.
 */
export const MENTION_PATTERN_SOURCE =
    "(?<pre>^|[^A-Za-z0-9._/@])@(?<handle>[A-Za-z0-9._]+)" as const;

/**
 * A fresh matcher each call. A `/g` regex carries `lastIndex`, so a shared one
 * would make the result depend on who read it last.
 */
export const createMentionPattern = () =>
    new RegExp(MENTION_PATTERN_SOURCE, "g");

/**
 * Trims what a sentence put there rather than the author.
 *
 * A handle may legally contain dots and underscores, so only trailing ones are
 * ambiguous: `@ada.` at the end of a sentence is the handle `ada`, while
 * `@ada.b` is the handle `ada.b`.
 */
export function trimHandle(raw: string): string {
    return raw.replace(/[._]+$/, "");
}

/**
 * Whether a trimmed handle could name an account at all — the bounds a
 * username is registered under, from the same constants the forms use.
 */
export function isHandleLength(handle: string): boolean {
    return (
        handle.length >= AUTH_LIMITS.usernameMin &&
        handle.length <= AUTH_LIMITS.usernameMax
    );
}

/**
 * The distinct handles a body names, in the casing and order they first
 * appear.
 *
 * Deduplicated case-insensitively, because the API resolves that way and the
 * limit counts distinct accounts rather than distinct spellings.
 *
 * Unlike the API's version this does not throw past the limit. It is read
 * while somebody types, and a composer counting what the author has written is
 * not the place to raise an error — the caller compares the length against
 * `MAX_MENTIONS` and decides.
 */
export function extractHandles(content: string): string[] {
    const handles: string[] = [];
    const seen = new Set<string>();

    for (const match of content.matchAll(createMentionPattern())) {
        const handle = trimHandle(match.groups?.handle ?? "");
        if (!isHandleLength(handle)) continue;

        const key = handle.toLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        handles.push(handle);
    }

    return handles;
}

/**
 * The resolved account for a handle as written, or `undefined`.
 *
 * Case-insensitive, because `@Ada` names the account `ada`.
 *
 * A handle with no match stays plain text wherever this is used, and that
 * covers three different situations on purpose: a typo, an account that has
 * been deleted, and one that has been renamed since the body was written. The
 * last is unmatchable by design — the API stores the relation by id and
 * returns the *current* handle, so nothing in the response ties it back to the
 * old spelling in the text. Guessing a pairing would eventually link
 * someone's name to a stranger's profile; leaving it as text never does.
 */
export function findMention(
    handle: string,
    mentions: Mention[] | undefined,
): Mention | undefined {
    if (!mentions?.length) return undefined;
    const key = handle.toLowerCase();
    return mentions.find((m) => m.username.toLowerCase() === key);
}

/** The handle being typed at the caret. */
export interface ActiveHandle {
    /** Index of the `@`. */
    start: number;
    /** What has been typed after it, possibly empty. */
    query: string;
}

/**
 * The handle being typed at the caret, if there is one.
 *
 * Scans back from the caret over the handle character set to the `@`, then
 * checks the character before it with the **same** rule the grammar uses — an
 * `@` glued to a word, a path or another `@` is not the start of a mention, so
 * typing inside an email address must not open a suggestion list. Offering
 * accounts for something that will never become a link is a worse lie than
 * offering nothing.
 *
 * Only the text before the caret becomes the query, so a caret dropped into
 * the middle of `@adamm` searches `ada`. React Native reports a caret move on
 * its own — a tap into the text, a drag of the handle — so unlike the web,
 * where the list is recomputed from the field's change event alone, this does
 * open there. That is the typo being corrected rather than a stray list, and
 * it is why `insertMention` replaces the whole handle rather than the part
 * that was read.
 */
export function readActiveHandle(
    value: string,
    caret: number,
): ActiveHandle | null {
    let i = Math.min(caret, value.length);
    while (i > 0 && /[A-Za-z0-9._]/.test(value[i - 1] ?? "")) i -= 1;
    if (i === 0 || value[i - 1] !== "@") return null;

    const at = i - 1;
    const before = at > 0 ? (value[at - 1] ?? "") : "";
    if (before && /[A-Za-z0-9._/@]/.test(before)) return null;

    return { start: at, query: value.slice(i, caret) };
}

/**
 * The body with a chosen account written over the handle being typed, and
 * where the caret goes after it.
 *
 * A trailing space is added, because the next thing typed is almost never
 * part of the handle — and without it the list reopens on the very character
 * that was meant to end it.
 *
 * **The whole handle goes, not just the part that was read.** `query` stops at
 * the caret, and a caret can sit inside a finished handle — somebody who
 * tapped into `@adamm` to correct it. Replacing only what precedes the caret
 * would leave the tail stranded behind the account they chose: `@adele mm`.
 */
export function insertMention(
    value: string,
    active: ActiveHandle,
    username: string,
): { text: string; caret: number } {
    let end = active.start + 1 + active.query.length;
    while (end < value.length && /[A-Za-z0-9._]/.test(value[end] ?? "")) {
        end += 1;
    }

    const inserted = `@${username} `;

    return {
        text: value.slice(0, active.start) + inserted + value.slice(end),
        caret: active.start + inserted.length,
    };
}
