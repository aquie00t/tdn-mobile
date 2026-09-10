import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { BackIcon } from "../ui/icons/lucide";
import { Text } from "../ui/Text";
import { useI18n } from "../hooks/useI18n";

export interface ScreenHeaderProps {
    title: string;
    /** Drawn on the right — an action belonging to whatever is below. */
    right?: React.ReactNode;
    /**
     * Off on a tab, which was not pushed and has nothing to go back to. The
     * arrow would be a control that either does nothing or leaves the app.
     */
    showBack?: boolean;
}

/**
 * The bar at the top of a pushed screen: a way back, and what you are looking
 * at.
 *
 * Drawn rather than configured, for the reason the tab bar is. The navigator's
 * own header takes colour *values* — `headerStyle`, `headerTintColor` — and
 * every colour here is a role in `global.css`; handing them over in JavaScript
 * would write each one down again in hex where no theme can reach it.
 *
 * The hardware back button and the edge-swipe already work without this. They
 * are not enough: nothing on screen said the gesture existed, and a screen
 * with no visible way out reads as a screen you are stuck on.
 */
export function ScreenHeader({
    title,
    right,
    showBack = true,
}: ScreenHeaderProps) {
    const { t } = useI18n();
    const router = useRouter();

    return (
        <View className="h-14 flex-row items-center gap-1 border-b border-ink/10 px-2">
            {showBack ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common.back")}
                    onPress={() => router.back()}
                    hitSlop={8}
                    className="h-10 w-10 items-center justify-center rounded-full active:bg-ink/10"
                >
                    <BackIcon size={22} className="text-ink" />
                </Pressable>
            ) : (
                <View className="w-2" />
            )}

            <Text
                size="lead"
                numberOfLines={1}
                className="flex-1 font-semibold"
            >
                {title}
            </Text>

            {right}
        </View>
    );
}
