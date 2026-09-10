import { Image } from "expo-image";
import { View } from "react-native";

import { cn } from "./cn";

export interface AvatarProps {
    /** An absolute URL. The caller decides what to draw when there is none. */
    uri: string;
    size?: number;
    className?: string;
}

/**
 * Somebody's picture, round and clipped.
 *
 * `uri` is required rather than optional, and the "no picture" case belongs to
 * the caller: in the tab bar the fallback is not an empty avatar but the
 * profile *icon*, which has to take the tab's own tone. A fallback here would
 * have to be told that tone anyway, and would then be a second thing to keep
 * in step with the bar's colours.
 *
 * `expo-image` rather than React Native's, for the disk cache — the same
 * handful of avatars scroll past on every screen.
 */
export function Avatar({ uri, size = 32, className }: AvatarProps) {
    return (
        <View
            className={cn(
                "overflow-hidden rounded-full border border-ink/20",
                className,
            )}
            style={{ width: size, height: size }}
        >
            <Image
                source={{ uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                // The ground shows through while it loads, which on a round
                // 22px mark reads as the avatar simply arriving.
                transition={150}
                // Rows are recycled as a list scrolls, and without this the
                // view keeps the previous author's face until the next one
                // decodes — the wrong picture beside the right name.
                recyclingKey={uri}
            />
        </View>
    );
}
