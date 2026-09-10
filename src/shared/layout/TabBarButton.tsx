import { Pressable, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import type { PressableProps } from "react-native";

import { Avatar } from "../ui/Avatar";
import { Text } from "../ui/Text";
import type { TranslationKey } from "../i18n/translations";
import { formatBadgeCount } from "../utils/badge-count";
import { useI18n } from "../hooks/useI18n";

export interface TabBarButtonProps extends PressableProps {
    icon: LucideIcon;
    label: TranslationKey;
    /**
     * How many are unread.
     *
     * Nothing fills this yet — the notification store lands with PR 15 and the
     * message store with PR 25. The badge is drawn now rather than added then,
     * because where it sits is a decision about this bar: over the icon's
     * corner, clear of the label beside it. A later PR should be wiring a
     * number up, not rearranging a tab.
     */
    badge?: number;
    /**
     * Somebody's own picture, in place of the glyph. The profile tab only.
     *
     * The web does this too, and it is worth the special case: a face is how
     * people find their own account in a row of five identical outlines.
     */
    avatarUrl?: string | null;
    /**
     * Set by `TabTrigger` through `asChild`, along with `onPress` and the rest
     * of the press handling. Optional because the type cannot say that; in
     * practice it is always supplied.
     */
    isFocused?: boolean;
}

/**
 * One tab.
 *
 * Drawn rather than configured. Expo Router's headless `Tabs` hands the press
 * handling to whatever component it wraps, which is what lets every colour
 * here stay a *class* — `ground`, `ink` and `accent` live in `global.css`, and
 * a navigator styled through `tabBarActiveTintColor` would need each of them
 * written down a second time in hex, where no theme could reach it.
 */
export function TabBarButton({
    icon: Icon,
    label,
    badge,
    avatarUrl,
    isFocused = false,
    /*
     * Dropped, and this is the whole reason it is named here.
     *
     * `TabTrigger` hands `asChild` children its own
     * `{ flexDirection: "row", justifyContent: "space-between" }` — a sensible
     * default for an unstyled trigger, and wrong for this one. It arrives as
     * an inline `style`, which wins over a class, so it turned each tab into a
     * row with the glyph and its label pushed to opposite ends. The layout
     * below is complete on its own.
     */
    style: _injectedByTabTrigger,
    ...props
}: TabBarButtonProps) {
    const { t } = useI18n();
    const count = formatBadgeCount(badge ?? 0);
    const tone = isFocused ? "text-ink" : "text-ink/40";
    const text = t(label);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={text}
            className="flex-1 items-center justify-center gap-0.5 py-2.5 active:bg-ink/5"
            {...props}
        >
            <View>
                {avatarUrl ? (
                    <Avatar uri={avatarUrl} size={22} />
                ) : (
                    <Icon size={22} className={tone} />
                )}

                {count && (
                    <View className="absolute -right-1.5 -top-1 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 py-0.5">
                        <Text
                            tone="onFill"
                            className="text-[10px] font-bold leading-none"
                        >
                            {count}
                        </Text>
                    </View>
                )}
            </View>

            {/*
             * 10px, below the type scale's smallest. A fifth of a 360px phone
             * is 72px and the scale's 12px `caption` wraps "Bildirimler" onto
             * two lines there — which is why the labels are the web's short
             * spellings as well.
             */}
            <Text
                size="caption"
                tone={isFocused ? "default" : "subtle"}
                numberOfLines={1}
                className="text-[10px]"
            >
                {text}
            </Text>
        </Pressable>
    );
}
