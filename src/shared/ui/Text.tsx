import { Text as RNText } from "react-native";
import type { TextProps as RNTextProps } from "react-native";

import { cn } from "./cn";

/**
 * Every string in the app goes through this, and that is not a style
 * preference.
 *
 * React Native's `Text` inherits nothing from the `View` around it — not the
 * font, not the size, and not the colour. A bare `<Text>` renders in the
 * platform default, which is black: invisible on the dark ground the app ships
 * with. On the web a `<p>` inside a themed container is themed; here it is
 * not, so the default has to live in a component.
 */

/** The type scale. Named for what they are, not for their pixel size. */
const SIZES = {
    caption: "text-xs",
    small: "text-sm",
    body: "text-base",
    lead: "text-lg",
    title: "text-xl font-semibold",
    display: "text-2xl font-semibold",
} as const;

/**
 * Foreground roles.
 *
 * `muted` and `subtle` are opacity steps on `ink` rather than separate colours,
 * so they follow the theme without needing values of their own — a faint grey
 * on black and a faint grey on white, from one token.
 */
const TONES = {
    default: "text-ink",
    muted: "text-ink/60",
    subtle: "text-ink/40",
    danger: "text-danger",
    success: "text-success",
    accent: "text-accent",
    /** On a filled accent or over a scrim — deliberately does not swap. */
    onFill: "text-on-fill",
} as const;

export interface TextProps extends RNTextProps {
    size?: keyof typeof SIZES;
    tone?: keyof typeof TONES;
    className?: string;
}

export function Text({
    size = "body",
    tone = "default",
    className,
    ...props
}: TextProps) {
    return (
        <RNText
            className={cn(SIZES[size], TONES[tone], className)}
            {...props}
        />
    );
}
