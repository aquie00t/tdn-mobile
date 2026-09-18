import { describe, expect, it } from "vitest";

import type { ArticleToken, MentionToken } from "./markdown";
import { parseArticleBody } from "./markdown";

const mentions = [{ id: "u1", username: "ada" }];

/** Every mention token anywhere in the tree, in the order they appear. */
function collectMentions(tokens: ArticleToken[]): MentionToken[] {
    const out: MentionToken[] = [];

    for (const token of tokens) {
        if (token.type === "mention") {
            out.push(token as MentionToken);
            continue;
        }

        // Table cells keep their inline content outside `tokens`, so this
        // walks them too — otherwise it would report that a handle in a table
        // was not linked when what it had actually done was not look.
        const node = token as {
            tokens?: ArticleToken[];
            items?: ArticleToken[];
            header?: { tokens?: ArticleToken[] }[];
            rows?: { tokens?: ArticleToken[] }[][];
        };
        if (node.tokens) out.push(...collectMentions(node.tokens));
        if (node.items) out.push(...collectMentions(node.items));
        node.header?.forEach((cell) => {
            if (cell.tokens) out.push(...collectMentions(cell.tokens));
        });
        node.rows?.forEach((row) =>
            row.forEach((cell) => {
                if (cell.tokens) out.push(...collectMentions(cell.tokens));
            }),
        );
    }

    return out;
}

/** The text of every text token, joined — what a reader would see as prose. */
function flatten(tokens: ArticleToken[]): string {
    return tokens
        .map((token) => {
            if (token.type === "mention") return `@${token.text}`;

            const node = token as {
                tokens?: ArticleToken[];
                items?: ArticleToken[];
                text?: string;
            };
            if (node.tokens) return flatten(node.tokens);
            if (node.items) return flatten(node.items);
            return node.text ?? "";
        })
        .join("");
}

describe("parseArticleBody", () => {
    it("parses a body into blocks", () => {
        const tokens = parseArticleBody("# Title\n\nA paragraph.\n", []);

        expect(tokens.map((t) => t.type)).toContain("heading");
        expect(tokens.map((t) => t.type)).toContain("paragraph");
    });

    it("links a handle the API resolved", () => {
        const tokens = parseArticleBody("Ask @ada about it.", mentions);

        expect(collectMentions(tokens)).toEqual([
            { type: "mention", raw: "@ada", text: "ada", username: "ada" },
        ]);
    });

    it("leaves a handle nothing resolved as text", () => {
        // The same rule as everywhere else: a typo, a deleted account and one
        // renamed since are equally unmatchable and all stay text.
        const tokens = parseArticleBody("Ask @bob about it.", mentions);

        expect(collectMentions(tokens)).toHaveLength(0);
        expect(flatten(tokens)).toContain("@bob");
    });

    it("does nothing at all when the API resolved nobody", () => {
        const tokens = parseArticleBody("Ask @ada about it.", []);

        expect(collectMentions(tokens)).toHaveLength(0);
    });

    it("matches case-insensitively", () => {
        // `@Ada` names the account `ada`, and the casing the author used is
        // what stays on the page.
        const tokens = parseArticleBody("@Ada wrote it", mentions);

        expect(collectMentions(tokens)[0]).toMatchObject({
            text: "Ada",
            username: "ada",
        });
    });

    it("leaves a handle whose account was renamed since as text", () => {
        // The relation is stored by id, so the API returns the handle *now*
        // and nothing ties it back to the old spelling in the text. Guessing
        // a pairing would eventually link somebody's name to a stranger.
        const tokens = parseArticleBody("@ada wrote it", [
            { id: "u1", username: "ada.lovelace" },
        ]);

        expect(collectMentions(tokens)).toHaveLength(0);
    });

    it("gives the trailing dot back to the sentence", () => {
        const tokens = parseArticleBody("Ask @ada.", mentions);

        expect(collectMentions(tokens)[0].text).toBe("ada");
        expect(flatten(tokens)).toBe("Ask @ada.");
    });

    it("reaches a handle inside emphasis", () => {
        // The walk is the whole point: a plain pass over the text would not
        // know it was inside anything.
        const tokens = parseArticleBody("**Ask @ada**", mentions);

        expect(collectMentions(tokens)).toHaveLength(1);
    });

    it("reaches a handle inside a list item", () => {
        const tokens = parseArticleBody("- ask @ada\n- and nobody\n", mentions);

        expect(collectMentions(tokens)).toHaveLength(1);
    });

    it("leaves a handle in a code span alone", () => {
        // An `@` in a snippet is part of the snippet — a decorator, an npm
        // scope, an address in an example.
        const tokens = parseArticleBody("Install `@ada/cli` first.", mentions);

        expect(collectMentions(tokens)).toHaveLength(0);
    });

    it("leaves a handle in a fenced block alone", () => {
        const tokens = parseArticleBody(
            "```ts\nimport x from '@ada/cli';\n```\n",
            mentions,
        );

        expect(collectMentions(tokens)).toHaveLength(0);
    });

    it("leaves a handle inside a link's label alone", () => {
        // A link inside a link is not a thing that can be drawn.
        const tokens = parseArticleBody(
            "[ask @ada](https://tdn.dev)",
            mentions,
        );

        expect(collectMentions(tokens)).toHaveLength(0);
    });

    it("does not fire inside an email address", () => {
        const tokens = parseArticleBody("write to me\\@ada.dev", mentions);

        expect(collectMentions(tokens)).toHaveLength(0);
    });

    it("takes a table, which is GFM rather than plain markdown", () => {
        const tokens = parseArticleBody(
            "| a | b |\n| - | - |\n| 1 | 2 |\n",
            [],
        );

        expect(tokens.map((t) => t.type)).toContain("table");
    });

    it("reaches a handle inside a table cell", () => {
        // A table keeps its inline content in cells rather than in `tokens`,
        // so without walking those a handle in a table would be the one place
        // in an article that stayed text while the paragraph above it linked.
        const tokens = parseArticleBody(
            "| who | why |\n| - | - |\n| @ada | first |\n",
            mentions,
        );

        expect(collectMentions(tokens)).toHaveLength(1);
    });

    it("reaches a handle in a table header", () => {
        const tokens = parseArticleBody(
            "| @ada | why |\n| - | - |\n| a | b |\n",
            mentions,
        );

        expect(collectMentions(tokens)).toHaveLength(1);
    });

    it("keeps a task list's state on the item", () => {
        // `marked` marks the item and *also* emits a `checkbox` token inside
        // it; the renderer draws the first as the bullet and drops the second,
        // so both have to survive the walk.
        const tokens = parseArticleBody("- [x] done\n- [ ] not\n", mentions);
        const list = tokens[0] as {
            items?: { task?: boolean; checked?: boolean }[];
        };

        expect(list.items?.map((item) => item.checked)).toEqual([true, false]);
        expect(list.items?.every((item) => item.task)).toBe(true);
    });

    it("keeps a link reference definition out of the prose", () => {
        // `[foo]: https://…` defines a link used elsewhere; it is markup
        // rather than content, and the renderer draws nothing for it.
        const tokens = parseArticleBody(
            "See [foo].\n\n[foo]: https://tdn.dev\n",
            [],
        );

        expect(tokens.map((t) => t.type)).toContain("def");
    });

    it("handles an empty body", () => {
        // `marked` answers a `TokensList` — an array carrying a `links` map —
        // so this asserts emptiness rather than identity with a bare `[]`.
        expect(parseArticleBody("", [])).toHaveLength(0);
    });
});
