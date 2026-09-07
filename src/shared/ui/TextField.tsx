import { TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";

import { Text } from "./Text";
import { cn } from "./cn";

export interface TextFieldProps extends TextInputProps {
    /** Shown under the field, in `danger`. Also reddens the border. */
    error?: string | null;
    className?: string;
}

/**
 * A text input, with the theme on it.
 *
 * PR 3 built seven primitives and stopped, on the rule that a component
 * designed without a call site is usually designed wrong. This is the call
 * site — the sign-in flow is the first thing in the app that asks anybody to
 * type.
 *
 * The placeholder and the selection handle are styled through NativeWind's
 * `placeholder:` and `selection:` variants, which move `color` onto React
 * Native's `placeholderTextColor` and `selectionColor` props. Setting those
 * props directly would mean a literal colour that cannot follow the theme;
 * left unset, the placeholder is the platform grey, which is nearly invisible
 * on the dark ground.
 */
export function TextField({ error, className, ...props }: TextFieldProps) {
    return (
        <View className="gap-1.5">
            <TextInput
                className={cn(
                    "rounded-xl border bg-ground px-4 py-3.5 text-base text-ink",
                    "placeholder:text-ink/35 selection:text-accent",
                    error ? "border-danger" : "border-ink/20",
                    className,
                )}
                {...props}
            />
            {error && (
                <Text size="small" tone="danger" className="px-1">
                    {error}
                </Text>
            )}
        </View>
    );
}
