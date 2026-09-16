import { marked } from "marked";
import type { Token, TokensList } from "marked";

import {
    createMentionPattern,
    findMention,
    isHandleLength,
    trimHandle,
} from "@shared/utils/mentions";
import type { Mention } from "@shared/utils/mentions";

/**
 * A handle the API resolved, marked in the tree so the renderer can draw it as
 * a link without matching text a second time.
 *
 * `marked` has no node for this, so one is added. It is not a `link`: a link
 * carries a URL the author wrote and opens outside the app, while this is an
 * account and opens a profile — and the renderer has to tell them apart.
 */
export interface MentionToken {
    type: "mention";
    raw: string;
    /** The handle **as written**, without its `@`. */
    text: string;
    /** The account's current handle, which is where a tap goes. */
    username: string;
}

/** Every token the renderer may meet, ours included. */
export type ArticleToken = Token | MentionToken;

/**
 * Where a handle is text but not a mention.
 *
 * `code` and `codespan` because an `@` in a snippet is part of the snippet — a
 * decorator, an npm scope, an email in an example. `link` and `image` because
 * their children are a label for something else, and turning half of one into
 * a second link produces a link inside a link.
 */
const OPAQUE = new Set(["code", "codespan", "link", "image", "html", "def"]);

/**
 * Splits one text token into the text and mention tokens it contains.
 *
 * Returns the token unchanged when it names nobody, so a body with no resolved
 * handles comes back as the tree `marked` produced.
 */
function splitText(token: Token, mentions: Mention[]): ArticleToken[] {
    const value = "text" in token ? (token.text ?? "") : "";
    const out: ArticleToken[] = [];
    let last = 0;

    for (const match of value.matchAll(createMentionPattern())) {
        const pre = match.groups?.pre ?? "";
        const written = match.groups?.handle ?? "";
        const handle = trimHandle(written);
        const mention = isHandleLength(handle)
            ? findMention(handle, mentions)
            : undefined;

        if (!mention) continue;

        const at = match.index + pre.length;
        if (at > last) {
            const slice = value.slice(last, at);
            out.push({ type: "text", raw: slice, text: slice } as Token);
        }

        out.push({
            type: "mention",
            raw: `@${handle}`,
            text: handle,
            username: mention.username,
        });

        // What the sentence put after the handle is left to the text that
        // follows: a trailing dot is punctuation, not part of the account.
        last = at + 1 + handle.length;
    }

    if (out.length === 0) return [token];

    if (last < value.length) {
        const rest = value.slice(last);
        out.push({ type: "text", raw: rest, text: rest } as Token);
    }

    return out;
}

/** Walks a token's children, replacing the text tokens that name somebody. */
function walk(tokens: ArticleToken[], mentions: Mention[]): ArticleToken[] {
    const out: ArticleToken[] = [];

    for (const token of tokens) {
        if (token.type === "text" && !("tokens" in token && token.tokens)) {
            out.push(...splitText(token as Token, mentions));
            continue;
        }

        if (!OPAQUE.has(token.type)) {
            const node = token as Token & {
                tokens?: Token[];
                items?: Token[];
                /*
                 * A GFM table keeps its inline content in cells rather than in
                 * `tokens`, so without these two a handle in a table would be
                 * the one place in an article that stayed plain text while the
                 * paragraph above it linked.
                 */
                header?: { tokens?: Token[] }[];
                rows?: { tokens?: Token[] }[][];
            };

            if (node.tokens) {
                node.tokens = walk(node.tokens, mentions) as Token[];
            }
            if (node.items) {
                node.items = walk(node.items, mentions) as Token[];
            }

            node.header?.forEach((cell) => {
                if (cell.tokens) {
                    cell.tokens = walk(cell.tokens, mentions) as Token[];
                }
            });
            node.rows?.forEach((row) =>
                row.forEach((cell) => {
                    if (cell.tokens) {
                        cell.tokens = walk(cell.tokens, mentions) as Token[];
                    }
                }),
            );
        }

        out.push(token);
    }

    return out;
}

/**
 * An article body, parsed and with its resolved handles marked.
 *
 * **Parsed into a tree, and the mentions linked inside it** rather than over
 * the rendered output. The body is markdown, so matching text after rendering
 * would have to tell a handle apart from a URL, a code span and a link label;
 * the tree already knows which is which. It is the same decision the web makes
 * with a remark plugin — the same walk over a different shape of node, because
 * there is no remark here.
 *
 * A handle becomes a link **only** when `mentions` carries it, on the same
 * reasoning as everywhere else: a typo, a deleted account and one renamed
 * since are all unmatchable and all stay text.
 *
 * Embedded HTML is left as tokens and dropped by the renderer rather than
 * parsed. The API stores and returns markdown unescaped and unsanitised by
 * design, so that the stored text is never mangled — which makes sanitising
 * the reader's job, and here it is done by omission.
 *
 * @param body - The raw markdown the API returned
 * @param mentions - The accounts it resolved out of that body
 */
export function parseArticleBody(
    body: string,
    mentions: Mention[] | undefined,
): ArticleToken[] {
    const tokens: TokensList = marked.lexer(body);

    if (!mentions?.length) return tokens;
    return walk(tokens, mentions);
}
