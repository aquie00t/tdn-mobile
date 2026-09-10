import { ActivityIndicator, Pressable } from "react-native";
import type { PressableProps } from "react-native";
import type { ReactNode } from "react";

import { Text } from "./Text";
import { cn } from "./cn";

/**
 * The four the web uses, minus its `lg` size — which is written at zero of 51
 * call sites there, so it is not ported.
 *
 * There is no `:hover` on a phone. The web's hover fills become pressed
 * fills, which is the same intent reached by the only input a finger has.
 */
const VARIANTS = {
    primary: { box: "bg-ink active:bg-ink-hover", onFill: true },
    secondary: { box: "bg-surface-2 active:bg-surface-3", onFill: false },
    outline: { box: "border border-ink/20 active:bg-ink/5", onFill: false },
    ghost: { box: "active:bg-ink/10", onFill: false },
} as const;

const SIZES = {
    sm: { box: "px-3 py-1.5", text: "small" },
    md: { box: "px-6 py-2.5", text: "body" },
    full: { box: "w-full py-3", text: "lead" },
} as const;

export interface ButtonProps extends Omit<PressableProps, "children"> {
    label: string;
    variant?: keyof typeof VARIANTS;
    size?: keyof typeof SIZES;
    loading?: boolean;
    /**
     * Drawn before the label, and swapped out by the spinner while loading —
     * a mark and an indicator in the same row read as two things happening.
     *
     * A node rather than a name, because the marks that need one are brand
     * artwork rather than members of an icon set: the icon knows its own size
     * and, where it has one, its own colour.
     */
    icon?: ReactNode;
    className?: string;
}

/**
 * `outline` at `sm` is the shape that carries the app — it is the retry button
 * under every failed list, and 17 of the web's 51 call sites.
 *
 * `label` is a prop rather than `children` so the text cannot be rendered
 * unstyled by accident: a raw string inside a `Pressable` needs a `Text` and
 * React Native throws without one, but a `<Text>` from the wrong import is
 * black on black instead, which does not throw.
 */
export function Button({
    label,
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    disabled,
    className,
    ...props
}: ButtonProps) {
    const v = VARIANTS[variant];
    const s = SIZES[size];
    const isDisabled = disabled || loading;
    // `primary` fills with `ink`, so its label is the *ground*. The pair swaps
    // wholesale between themes, which is what keeps it legible in both.
    const labelTone = v.onFill ? "text-ground" : "text-ink";

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!isDisabled, busy: loading }}
            disabled={isDisabled}
            className={cn(
                "flex-row items-center justify-center gap-2 rounded-full",
                s.box,
                v.box,
                isDisabled && "opacity-50",
                className,
            )}
            {...props}
        >
            {loading ? (
                <ActivityIndicator size="small" className={labelTone} />
            ) : (
                icon
            )}
            <Text size={s.text} className={cn("font-semibold", labelTone)}>
                {label}
            </Text>
        </Pressable>
    );
}
