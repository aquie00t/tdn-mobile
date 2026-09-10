interface Run {
    value: string;
    /**
     * Where the run starts in the body.
     *
     * Carried so a renderer has a key that depends on the data rather than on
     * the loop: the runs are a pure function of the text, so an offset names
     * the same run until the body itself changes.
     */
    start: number;
}

export type RichTextRun =
    | ({ kind: "text" } & Run)
    | ({ kind: "bold" } & Run)
    | ({ kind: "url" } & Run);

/**
 * One pass, two alternatives, named groups.
 *
 * Bold is non-greedy, or `**a** and **b**` becomes a single run that swallows
 * the words between them. The URL branch stops at whitespace and at the
 * characters that usually end a sentence wrapped around a link.
 */
const PATTERN = /\*\*(?<bold>.+?)\*\*|(?<url>https?:\/\/[^\s<>"']+)/g;

/**
 * Splits a body into the runs a renderer draws.
 *
 * The web's `RichText` reads four things: `**bold**`, URLs, `#tags` and
 * `@mentions`. Two of them are here, and the other two are left as text
 * deliberately rather than by omission. A tag opens a feed filtered to it and
 * a mention opens a profile; neither screen exists yet, so drawing them as
 * links would be blue words that answer a tap with nothing — which reads as
 * broken, where plain text reads as text.
 *
 * Mentions arrive with PR 24, and with them the rule that makes them safe: the
 * API returns the body unchanged and lists the accounts it resolved
 * separately, so a handle with no entry in that list has to stay plain or the
 * app links somebody's name to a stranger's profile.
 *
 * Parsing lives here rather than in the component because this is the part
 * worth testing — the component only decides what each run looks like.
 *
 * @param text - The body as it was written
 * @returns The runs, in order
 */
export function splitRichText(text: string): RichTextRun[] {
    const runs: RichTextRun[] = [];
    const pattern = new RegExp(PATTERN.source, "g");

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            runs.push({
                kind: "text",
                value: text.slice(lastIndex, match.index),
                start: lastIndex,
            });
        }

        const groups = match.groups ?? {};

        if (groups.bold !== undefined) {
            runs.push({ kind: "bold", value: groups.bold, start: match.index });
        } else if (groups.url !== undefined) {
            runs.push({ kind: "url", value: groups.url, start: match.index });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        runs.push({
            kind: "text",
            value: text.slice(lastIndex),
            start: lastIndex,
        });
    }

    return runs;
}
