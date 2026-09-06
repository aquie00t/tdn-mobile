import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "./Text";
import { cn } from "./cn";
import { useToastStore } from "../store/toast.store";
import type { ToastType } from "../store/toast.store";

/**
 * All three sit on `surface-1` and differ only at the edge, which is the web's
 * arrangement: a toast is a raised panel, and its type is a detail on it rather
 * than a different kind of object.
 */
const EDGES: Record<ToastType, string> = {
    error: "border-danger",
    success: "border-success",
    info: "border-ink/20",
};

/**
 * Mounted once, in the root layout, above the navigator.
 *
 * `pointerEvents="box-none"` on the wrapper is the part worth reading twice:
 * the container fills the screen so its children can be positioned against it,
 * and without this it would swallow every tap meant for the screen underneath.
 * `box-none` lets touches pass through the container while its children stay
 * tappable — the native equivalent of the web's `pointer-events-none` wrapper
 * with `pointer-events-auto` on each toast.
 *
 * Positioned from the bottom because that is where a thumb is, and above the
 * inset so it clears the gesture bar.
 */
export function ToastHost() {
    const toasts = useToastStore((s) => s.toasts);
    const removeToast = useToastStore((s) => s.removeToast);
    const insets = useSafeAreaInsets();

    if (toasts.length === 0) return null;

    return (
        <View
            pointerEvents="box-none"
            className="absolute inset-x-0 bottom-0 gap-2 p-4"
            style={{ paddingBottom: insets.bottom + 16 }}
        >
            {toasts.map((toast) => (
                <Pressable
                    key={toast.id}
                    accessibilityRole="alert"
                    onPress={() => removeToast(toast.id)}
                    className={cn(
                        "rounded-2xl border bg-surface-1 px-4 py-3",
                        EDGES[toast.type],
                    )}
                >
                    <Text size="small">{toast.message}</Text>
                </Pressable>
            ))}
        </View>
    );
}
