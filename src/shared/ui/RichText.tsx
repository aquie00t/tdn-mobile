import { Fragment } from "react";
import { Linking } from "react-native";

import { splitRichText } from "../utils/rich-text";
import { Text } from "./Text";
import type { TextProps } from "./Text";

export interface RichTextProps extends TextProps {
    text: string;
}

/**
 * A body, with its bold runs bold and its links pressable.
 *
 * `splitRichText` decides what the runs are and why the other two kinds of
 * markup are left alone; this only draws them.
 *
 * Nested `Text` is the one place React Native does inherit — a child takes its
 * parent's size and colour — so the bold and the link ride on whatever the
 * caller set here rather than each carrying their own.
 */
export function RichText({ text, ...props }: RichTextProps) {
    return (
        <Text {...props}>
            {splitRichText(text).map((run) => {
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

                return <Fragment key={run.start}>{run.value}</Fragment>;
            })}
        </Text>
    );
}
