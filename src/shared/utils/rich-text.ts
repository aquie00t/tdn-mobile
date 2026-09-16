import {
    MENTION_PATTERN_SOURCE,
    findMention,
    isHandleLength,
    trimHandle,
} from "./mentions";
import type { Mention } from "./mentions";

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
    | ({ kind: "url" } & Run)
    /**
     * `value` is the handle **as the author wrote it**, without its `@` and
     * without the punctuation a sentence put after it; `username` is the
     * account's current handle, which is where a tap goes. The two differ
     * after a rename, and that difference is the point — see below.
     */
    | ({ kind: "mention"; username: string } & Run);

/**
 * One pass, three alternatives, named groups.
 *
 * Bold is non-greedy, or `**a** and **b**` becomes a single run that swallows
 * the words between them. The URL branch stops at whitespace and at the
 * characters that usually end a sentence wrapped around a link.
 *
 * The mention branch is `MENTION_PATTERN_SOURCE` verbatim — it names its own
 * groups, so this composes it rather than restating it. A grammar written out
 * twice is how the client stops agreeing with the server, and the
 * disagreement shows up as a link that quietly never appears.
 *
 * Kept as a literal and joined through `.source` rather than written as one
 * string: a character class full of backslashes survives a literal and is a
 * transcription error waiting to happen inside quotes.
 */
const MARKUP = /\*\*(?<bold>.+?)\*\*|(?<url>https?:\/\/[^\s<>"']+)/;

const PATTERN_SOURCE = `${MARKUP.source}|${MENTION_PATTERN_SOURCE}`;

/**
 * Splits a body into the runs a renderer draws.
 *
 * The web's `RichText` reads four things: `**bold**`, URLs, `@mentions` and
 * `#tags`. Three of them are here, and tags are left as text deliberately
 * rather than by omission — a tag opens a feed filtered to it, that screen
 * does not exist yet, and a blue word answering a tap with nothing reads as
 * broken where plain text reads as text.
 *
 * A handle becomes a link **only** when `mentions` carries it. The API returns
 * the body unchanged and says separately which handles it resolved, so the
 * pairing is the client's job and the unmatched cases are all the same case: a
 * typo, a deleted account, and one renamed since it was written are equally
 * unresolvable. Linking on the text alone would eventually point somebody's
 * name at a stranger's profile; leaving it plain never does.
 *
 * Parsing lives here rather than in the component because this is the part
 * worth testing — the component only decides what each run looks like.
 *
 * @param text - The body as it was written
 * @param mentions - The accounts the API resolved out of this body. Absent
 *   where it resolves none: a quoted post card carries no `mentions`, and
 *   neither does a bio.
 * @returns The runs, in order
 */
export function splitRichText(
    text: string,
    mentions?: Mention[],
): RichTextRun[] {
    const runs: RichTextRun[] = [];
    const pattern = new RegExp(PATTERN_SOURCE, "g");

    /**
     * Text joins the run before it when that one is text too.
     *
     * The mention branch emits up to three runs for one match — the character
     * before the `@`, the handle, the punctuation after it — and without this
     * a body whose only markup is an unresolved handle would come back in
     * three pieces that render identically to one.
     */
    const pushText = (value: string, start: number) => {
        if (value.length === 0) return;

        const last = runs[runs.length - 1];
        if (last?.kind === "text") {
            last.value += value;
            return;
        }

        runs.push({ kind: "text", value, start });
    };

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            pushText(text.slice(lastIndex, match.index), lastIndex);
        }

        const groups = match.groups ?? {};

        if (groups.bold !== undefined) {
            runs.push({ kind: "bold", value: groups.bold, start: match.index });
        } else if (groups.url !== undefined) {
            runs.push({ kind: "url", value: groups.url, start: match.index });
        } else if (groups.handle !== undefined) {
            // The character before the `@` was consumed to prove the handle
            // starts a word; it belongs to the surrounding text.
            const pre = groups.pre ?? "";
            pushText(pre, match.index);

            const at = match.index + pre.length;
            const written = groups.handle;
            const handle = trimHandle(written);
            const mention = isHandleLength(handle)
                ? findMention(handle, mentions)
                : undefined;

            if (mention) {
                /*
                 * The text stays as the author typed it and the link points at
                 * the account's current handle. Those differ after a rename,
                 * and drawing the new one would silently rewrite what somebody
                 * wrote, while sending the reader to the old one would 404.
                 */
                runs.push({
                    kind: "mention",
                    value: handle,
                    username: mention.username,
                    start: at,
                });
                pushText(written.slice(handle.length), at + 1 + handle.length);
            } else {
                pushText(`@${written}`, at);
            }
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        pushText(text.slice(lastIndex), lastIndex);
    }

    return runs;
}
