import { View } from "react-native";

import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface BlockedNoticeProps {
    username: string;
    /** True when you blocked them; false when they blocked you. */
    isBlockedByMe: boolean;
}

/**
 * Stands in for the whole content area when a block is in place.
 *
 * The posts are not simply hidden — the server answers a blocked profile's
 * posts with an empty page either way, and an empty list reads as "this
 * account has never written anything", which is a different and wrong thing to
 * tell a reader. Saying what actually happened is the only version that is
 * true.
 *
 * The two directions get different words, and the keys were written for both:
 * one names the account you blocked, the other does not name anything you
 * could act on.
 */
export function BlockedNotice({ username, isBlockedByMe }: BlockedNoticeProps) {
    const { t } = useI18n();

    return (
        <View className="items-center gap-2 px-8 py-12">
            <Text size="small" className="text-center font-semibold">
                {t(
                    isBlockedByMe
                        ? "block.youBlockedTitle"
                        : "block.blockedYouTitle",
                    { username },
                )}
            </Text>
            <Text size="small" tone="subtle" className="text-center">
                {t(
                    isBlockedByMe
                        ? "block.youBlockedBody"
                        : "block.blockedYouBody",
                )}
            </Text>
        </View>
    );
}
