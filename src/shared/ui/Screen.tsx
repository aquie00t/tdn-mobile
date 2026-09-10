import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactNode } from "react";

import { cn } from "./cn";

/** Hoisted so the default is one object rather than a new one per render. */
const ALL_EDGES = { top: true, bottom: true } as const;

export interface ScreenProps {
    children: ReactNode;
    /** Scrolls its content. Off by default: a list brings its own scrolling. */
    scroll?: boolean;
    /**
     * Which insets to honour.
     *
     * **Anything inside the tab navigator wants the top only**, and that now
     * means every detail screen too: they live in a tab's own stack, so the
     * bar is drawn below them and already fills the gesture strip. Asking for
     * the bottom as well puts an empty band between a docked composer and the
     * bar — which is exactly what it looked like.
     *
     * The screens pushed over everything — the composer, the sign-in flow —
     * do want it, because nothing else is down there.
     */
    edges?: { top?: boolean; bottom?: boolean };
    className?: string;
}

/**
 * The page behind everything: the ground colour, and the notch.
 *
 * The insets come from the hook rather than from `SafeAreaView`, because a
 * scrolling screen wants its padding *inside* the scroll view — content should
 * pass under the notch as it moves, and stop clear of it at rest. A
 * `SafeAreaView` wrapper clips it instead.
 */
export function Screen({
    children,
    scroll = false,
    edges = ALL_EDGES,
    className,
}: ScreenProps) {
    const insets = useSafeAreaInsets();
    const padding = {
        paddingTop: edges.top ? insets.top : 0,
        paddingBottom: edges.bottom ? insets.bottom : 0,
    };

    if (scroll) {
        return (
            <ScrollView
                className={cn("flex-1 bg-ground", className)}
                contentContainerStyle={padding}
                keyboardShouldPersistTaps="handled"
            >
                {children}
            </ScrollView>
        );
    }

    return (
        <View className={cn("flex-1 bg-ground", className)} style={padding}>
            {children}
        </View>
    );
}
