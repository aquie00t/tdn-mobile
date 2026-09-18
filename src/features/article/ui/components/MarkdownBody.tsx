import { Image } from "expo-image";
import { Linking, ScrollView, View } from "react-native";
import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import type { ArticleToken, MentionToken } from "../../domain/markdown";
import { getSafeMediaUri } from "@shared/utils/media-uri";
import type { Mention } from "@shared/utils/mentions";
import { parseArticleBody } from "../../domain/markdown";
import { safeLinkUri } from "@shared/utils/web-url";
import { Text } from "@shared/ui/Text";

export interface MarkdownBodyProps {
    body: string;
    /** The accounts the API resolved out of this body. */
    mentions: Mention[] | undefined;
}

/**
 * A picture in a body.
 *
 * `contain` inside a 16:9 box rather than a height taken from the file: the
 * intrinsic size is unknown until it loads, and a portrait screenshot given
 * its own proportions fills the screen and pushes the paragraph it belongs to
 * out of sight. Scaled whole, nothing is cropped out of the illustration.
 */
function MarkdownImage({ uri }: { uri: string }) {
    const safe = getSafeMediaUri(uri);
    if (!safe) return null;

    return (
        <Image
            source={{ uri: safe }}
            style={IMAGE}
            contentFit="contain"
            transition={150}
            className="rounded-xl border border-ink/10 bg-surface-2"
        />
    );
}

const IMAGE = { width: "100%", aspectRatio: 16 / 9 } as const;

/**
 * What stands at the head of a list item.
 *
 * A task list is an unordered list whose items carry `task` and `checked`, and
 * `marked` also puts a `checkbox` token inside the item — which the renderer
 * drops, because that state belongs where the bullet is rather than in the
 * middle of the sentence.
 */
function bulletFor(
    ordered: boolean | undefined,
    item: ArticleToken,
    start: number,
    index: number,
): string {
    const task = item as { task?: boolean; checked?: boolean };

    if (task.task) return task.checked ? "☑" : "☐";
    return ordered ? `${start + index}.` : "•";
}

/*
 * Keys below are the node's path through the tree — `b3.1.0` — and
 * `no-array-index-key` is suppressed at each of them for one reason, written
 * once here.
 *
 * The rule exists for lists that reorder, where an index key attaches state to
 * the wrong row. This tree does not reorder: it is a pure function of the
 * body, rebuilt whole when the body changes and otherwise identical, and none
 * of these nodes holds state. A path is the same kind of key `rich-text.ts`
 * uses for its runs, and for the same reason — it is a property of the text
 * rather than of the loop. Disabled for the file rather than at each of the
 * four sites: it is one decision about how this tree is keyed, not four.
 */
/* eslint-disable react/no-array-index-key */

/** Heading sizes, by depth. Six levels because markdown has six. */
const HEADINGS = [
    "text-[26px] font-bold leading-8",
    "text-[22px] font-bold leading-7",
    "text-[19px] font-semibold leading-7",
    "text-[17px] font-semibold",
    "text-[16px] font-semibold",
    "text-[15px] font-semibold",
] as const;

/**
 * An article body.
 *
 * **Drawn rather than configured**, which is the same decision the tab bar and
 * the header made and for the same reason. Every markdown renderer for React
 * Native takes a `styles` object of colour *values*; every colour in this app
 * is a role in `global.css`, so handing one a palette would mean writing each
 * role down again in hex where no theme could reach it — and one of those
 * anywhere is a spot that stays dark on a light screen. `marked` supplies the
 * tree, and this decides what each node looks like in classes.
 *
 * `domain/markdown.ts` owns the parsing and says why the mentions are linked
 * inside the tree rather than over the output.
 *
 * **Embedded HTML is dropped, not rendered.** The API stores and returns
 * markdown unescaped and unsanitised so the author's text is never mangled,
 * which makes sanitising the reader's job; here it is done by omission, and
 * the `html` case below is the whole of it. Rendering it on a site where
 * anybody may publish is stored XSS.
 */
export function MarkdownBody({ body, mentions }: MarkdownBodyProps) {
    const router = useRouter();

    // A parse of up to 100,000 characters is not something to repeat because
    // a parent re-rendered.
    const tokens = useMemo(
        () => parseArticleBody(body, mentions),
        [body, mentions],
    );

    /**
     * The inline half: everything that lives inside a line of prose, returned
     * as children of one `Text` so it wraps as a paragraph rather than as a
     * row of boxes.
     */
    const renderInline = (
        nodes: ArticleToken[] | undefined,
        keyPrefix: string,
    ): ReactNode =>
        nodes?.map((node, index) => {
            const key = `${keyPrefix}.${index}`;

            switch (node.type) {
                case "mention": {
                    const mention = node as MentionToken;
                    return (
                        <Text
                            key={key}
                            tone="accent"
                            className="font-medium"
                            accessibilityRole="link"
                            // Drawn as written, pointed at the account's
                            // current handle — the two differ after a rename.
                            onPress={() =>
                                router.push({
                                    pathname: "/profile/[username]",
                                    params: { username: mention.username },
                                })
                            }
                        >
                            @{mention.text}
                        </Text>
                    );
                }

                case "link": {
                    /*
                     * The one place in this file where the content is not just
                     * drawn but *acted on*, and the author wrote it.
                     * `safeLinkUri` says why only http and https get through;
                     * anything else keeps its label and stops being pressable,
                     * which is the honest rendering of a link that goes
                     * nowhere we are willing to follow.
                     */
                    const href = safeLinkUri(
                        "href" in node ? node.href : undefined,
                    );
                    return (
                        <Text
                            key={key}
                            tone={href ? "accent" : "default"}
                            onPress={
                                href
                                    ? () =>
                                          // Swallowed: a scheme the device has
                                          // nothing registered for rejects,
                                          // and a red box about somebody's own
                                          // tap helps nobody.
                                          void Linking.openURL(href).catch(
                                              () => {},
                                          )
                                    : undefined
                            }
                        >
                            {renderInline(
                                ("tokens" in node
                                    ? node.tokens
                                    : undefined) as ArticleToken[],
                                key,
                            ) ?? ("text" in node ? node.text : "")}
                        </Text>
                    );
                }

                case "strong":
                    return (
                        <Text key={key} className="font-bold">
                            {renderInline(
                                ("tokens" in node
                                    ? node.tokens
                                    : undefined) as ArticleToken[],
                                key,
                            )}
                        </Text>
                    );

                case "em":
                    return (
                        <Text key={key} className="italic">
                            {renderInline(
                                ("tokens" in node
                                    ? node.tokens
                                    : undefined) as ArticleToken[],
                                key,
                            )}
                        </Text>
                    );

                case "del":
                    return (
                        <Text key={key} className="line-through">
                            {renderInline(
                                ("tokens" in node
                                    ? node.tokens
                                    : undefined) as ArticleToken[],
                                key,
                            )}
                        </Text>
                    );

                case "codespan":
                    return (
                        <Text
                            key={key}
                            className="rounded bg-ink/10 font-mono text-[14px]"
                        >
                            {" "}
                            {"text" in node ? node.text : ""}{" "}
                        </Text>
                    );

                case "br":
                    return <Fragment key={key}>{"\n"}</Fragment>;

                /*
                 * The marker of a task list item, drawn as that item's bullet
                 * — see `bulletFor`. Left here it would be an empty node in
                 * the middle of the line.
                 */
                case "checkbox":
                    return null;

                // Dropped rather than drawn — see the note above.
                case "html":
                    return null;

                /*
                 * Inline only. A picture on a line of its own is caught by the
                 * paragraph case and drawn; one in the middle of a sentence
                 * cannot be, so what it was *of* is kept instead of a gap.
                 */
                case "image":
                    return (
                        <Fragment key={key}>
                            {"text" in node ? node.text : ""}
                        </Fragment>
                    );

                default: {
                    const nested = (
                        "tokens" in node ? node.tokens : undefined
                    ) as ArticleToken[] | undefined;

                    if (nested?.length) return renderInline(nested, key);

                    return (
                        <Fragment key={key}>
                            {"text" in node ? node.text : ""}
                        </Fragment>
                    );
                }
            }
        });

    /** The block half: everything that owns a line of its own. */
    const renderBlock = (node: ArticleToken, key: string): ReactNode => {
        switch (node.type) {
            case "heading": {
                const depth = "depth" in node ? node.depth : 1;
                return (
                    <Text
                        key={key}
                        className={`pt-5 ${HEADINGS[Math.min(depth, 6) - 1]}`}
                    >
                        {renderInline(
                            ("tokens" in node
                                ? node.tokens
                                : undefined) as ArticleToken[],
                            key,
                        )}
                    </Text>
                );
            }

            case "paragraph": {
                /*
                 * A paragraph holding nothing but a picture is a picture.
                 *
                 * React Native will not put a `View` inside a `Text`, so an
                 * image cannot be drawn where it sits inline — and an author
                 * writing one on a line of its own, which is how every
                 * illustration in an article is written, produces exactly this
                 * shape. Anything else with an image in it keeps the alt text.
                 */
                const inner = ("tokens" in node ? node.tokens : []) as
                    ArticleToken[] | undefined;

                if (inner?.length === 1 && inner[0].type === "image") {
                    const image = inner[0] as { href?: string };
                    return <MarkdownImage key={key} uri={image.href ?? ""} />;
                }

                return (
                    <Text key={key} className="text-[17px] leading-7">
                        {renderInline(
                            ("tokens" in node
                                ? node.tokens
                                : undefined) as ArticleToken[],
                            key,
                        )}
                    </Text>
                );
            }

            case "blockquote":
                return (
                    <View
                        key={key}
                        className="border-l-[3px] border-ink/25 pl-4"
                    >
                        {(
                            ("tokens" in node
                                ? node.tokens
                                : []) as ArticleToken[]
                        ).map((child, index) =>
                            renderBlock(child, `${key}.${index}`),
                        )}
                    </View>
                );

            case "list": {
                const list = node as {
                    ordered?: boolean;
                    start?: number | "";
                    items?: ArticleToken[];
                };
                const start = typeof list.start === "number" ? list.start : 1;

                return (
                    <View key={key} className="gap-2">
                        {list.items?.map((item, index) => (
                            <View
                                key={`${key}.${index}`}
                                className="flex-row gap-2"
                            >
                                <Text
                                    tone="muted"
                                    className="text-[17px] leading-7"
                                >
                                    {bulletFor(
                                        list.ordered,
                                        item,
                                        start,
                                        index,
                                    )}
                                </Text>
                                <View className="flex-1 gap-2">
                                    {(
                                        ("tokens" in item
                                            ? item.tokens
                                            : []) as ArticleToken[]
                                    ).map((child, childIndex) =>
                                        renderBlock(
                                            child,
                                            `${key}.${index}.${childIndex}`,
                                        ),
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                );
            }

            case "code":
                return (
                    <ScrollView
                        key={key}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="rounded-xl border border-ink/10 bg-surface-1"
                        contentContainerClassName="p-3"
                    >
                        <Text
                            tone="muted"
                            className="font-mono text-[13px] leading-5"
                        >
                            {"text" in node ? node.text : ""}
                        </Text>
                    </ScrollView>
                );

            case "table": {
                const table = node as {
                    header?: { tokens?: ArticleToken[] }[];
                    rows?: { tokens?: ArticleToken[] }[][];
                };

                return (
                    <ScrollView
                        key={key}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                    >
                        <View className="overflow-hidden rounded-xl border border-ink/10">
                            <View className="flex-row bg-ink/5">
                                {table.header?.map((cell, index) => (
                                    <View
                                        key={`${key}.h.${index}`}
                                        className="min-w-[120px] border-r border-ink/10 px-3 py-2"
                                    >
                                        <Text
                                            size="small"
                                            className="font-semibold"
                                        >
                                            {renderInline(
                                                cell.tokens,
                                                `${key}.h.${index}`,
                                            )}
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            {table.rows?.map((row, rowIndex) => (
                                <View
                                    key={`${key}.r.${rowIndex}`}
                                    className="flex-row border-t border-ink/10"
                                >
                                    {row.map((cell, cellIndex) => (
                                        <View
                                            key={`${key}.r.${rowIndex}.${cellIndex}`}
                                            className="min-w-[120px] border-r border-ink/10 px-3 py-2"
                                        >
                                            <Text size="small">
                                                {renderInline(
                                                    cell.tokens,
                                                    `${key}.r.${rowIndex}.${cellIndex}`,
                                                )}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                );
            }

            case "hr":
                return <View key={key} className="h-px bg-ink/10" />;

            // The lexer emits these between blocks; the gap is drawn by the
            // container's own spacing rather than by a node.
            case "space":
                return null;

            case "html":
                return null;

            /*
             * A link reference definition — `[foo]: https://…` — is markup
             * that defines a link used elsewhere, not content. It reaches the
             * top level as a token of its own and carries no text, so drawn it
             * is a blank line the reader cannot account for.
             */
            case "def":
                return null;

            // The marker of a task list item. Drawn as the bullet instead.
            case "checkbox":
                return null;

            default:
                return (
                    <Text key={key} className="text-[17px] leading-7">
                        {renderInline([node], key)}
                    </Text>
                );
        }
    };

    return (
        <View className="gap-4 px-4 py-5">
            {tokens.map((token, index) => renderBlock(token, `b${index}`))}
        </View>
    );
}
