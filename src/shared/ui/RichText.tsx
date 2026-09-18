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
 * Nested `Text` is the one place React Native inherits — a child takes its
 * parent's size and colour — but only a bare one. Ours always sets a colour of
 * its own, so each run is handed the caller's tone explicitly: the bold keeps
 * it, and links and handles take `accent`, or keep it underlined on a blue
 * fill where `accent` would vanish.
 */
export function RichText({ text, mentions, ...props }: RichTextProps) {
    const router = useRouter();

    /*
     * Links and handles are blue — except on a blue fill, your own message
     * bubble, where blue on blue is a link nobody can see. There they keep
     * the text's own colour and are marked by an underline instead.
     */
    const onFill = props.tone === "onFill";
    const linkTone = onFill ? "onFill" : "accent";
    const linkMark = onFill ? "underline" : undefined;

    // A regex pass over the body on every render is small and never free; a
    // feed redraws its rows for reasons that have nothing to do with the words
    // in them.
    const runs = useMemo(() => splitRichText(text, mentions), [text, mentions]);

    return (
        <Text {...props}>
            {runs.map((run) => {
                if (run.kind === "bold") {
                    return (
                        /*
                         * The body's own tone, passed on by hand. `Text`
                         * always sets a colour, so a nested one does not
                         * inherit its parent's the way a bare React Native
                         * `Text` would — left to default, a bold word in your
                         * own blue bubble was `ink` among white.
                         */
                        <Text
                            key={run.start}
                            tone={props.tone}
                            className="font-bold"
                        >
                            {run.value}
                        </Text>
                    );
                }

                if (run.kind === "url") {
                    return (
                        <Text
                            key={run.start}
                            tone={linkTone}
                            className={linkMark}
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
                            tone={linkTone}
                            className={
                                linkMark
                                    ? `font-medium ${linkMark}`
                                    : "font-medium"
                            }
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
