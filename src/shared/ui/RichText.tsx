import { Fragment, useMemo } from "react";
import { Linking } from "react-native";
import { useRouter } from "expo-router";

import type { Mention } from "../utils/mentions";
import { splitRichText } from "../utils/rich-text";
import { Text } from "./Text";
import type { TextProps } from "./Text";

export interface RichTextProps extends TextProps {
    text: string;
    /**
     * The accounts the API resolved out of this body.
     *
     * Taken rather than derived, and that is the whole design — see
     * `splitRichText`. Left out where the API resolves nothing: a quoted post
     * card and a profile bio both arrive without it, and their handles stay
     * plain text.
     */
    mentions?: Mention[];
}

/**
 * A body, with its bold runs bold and its links and handles pressable.
 *
 * `splitRichText` decides what the runs are and why a tag is left alone; this
 * only draws them.
 *
 * Nested `Text` is the one place React Native does inherit — a child takes its
 * parent's size and colour — so the bold, the link and the mention ride on
 * whatever the caller set here rather than each carrying their own.
 */
export function RichText({ text, mentions, ...props }: RichTextProps) {
    const router = useRouter();

    // A regex pass over the body on every render is small and never free; a
    // feed redraws its rows for reasons that have nothing to do with the words
    // in them.
    const runs = useMemo(() => splitRichText(text, mentions), [text, mentions]);

    return (
        <Text {...props}>
            {runs.map((run) => {
                if (run.kind === "bold") {
                    return (
                        <Text key={run.start} className="font-bold">
                            {run.value}
                        </Text>
                    );
                }

                if (run.kind === "url") {
                    return (
                        <Text
                            key={run.start}
                            tone="accent"
                            // Nested inside a card that opens on press. React
                            // Native gives a tap to the innermost `Text` with a
                            // handler, so the link wins over the row without a
                            // stopPropagation of its own.
                            onPress={() => void Linking.openURL(run.value)}
                        >
                            {run.value}
                        </Text>
                    );
                }

                if (run.kind === "mention") {
                    return (
                        <Text
                            key={run.start}
                            tone="accent"
                            className="font-medium"
                            accessibilityRole="link"
                            // The handle as written is what is drawn; where it
                            // goes is the account's current one.
                            onPress={() =>
                                router.push({
                                    pathname: "/profile/[username]",
                                    params: { username: run.username },
                                })
                            }
                        >
                            @{run.value}
                        </Text>
                    );
                }

                return <Fragment key={run.start}>{run.value}</Fragment>;
            })}
        </Text>
    );
}
