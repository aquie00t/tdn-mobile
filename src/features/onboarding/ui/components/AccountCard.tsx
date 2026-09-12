import { View } from "react-native";
import { memo } from "react";

import { Avatar } from "@shared/ui/Avatar";
import type { BotProfile } from "../../data/bot.types";
import { Button } from "@shared/ui/Button";
import { CATEGORY_OPTIONS } from "@shared/constants/categories";
import type { CategoryValue } from "@shared/constants/categories";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import type { TranslationKey } from "@shared/i18n/translations";
import { useI18n } from "@shared/hooks/useI18n";

/**
 * Built from the same five options the picker offers, so a chip can never name
 * a field the reader was not able to choose.
 */
const CATEGORY_LABELS = new Map<CategoryValue, TranslationKey>(
    CATEGORY_OPTIONS.map(({ value, labelKey }) => [value, labelKey]),
);

export interface AccountCardProps {
    account: BotProfile;
    isFollowing: boolean;
    isPending: boolean;
    onToggle: (userId: string) => void;
}

/**
 * One suggested account.
 *
 * Not a `Pressable` row, unlike every other account list in the app: there is
 * nowhere to go from here. Opening a profile mid-flow would leave the reader
 * on a screen the gate immediately sends them back out of.
 *
 * The follow state comes in as a prop and the tap goes out as one, because the
 * flow counts follows above the list — and because a `FlatList` unmounts a row
 * as it scrolls out of the window, so state a row kept itself would be
 * discarded and re-seeded from a stale copy.
 */
function AccountCardView({
    account,
    isFollowing,
    isPending,
    onToggle,
}: AccountCardProps) {
    const { t } = useI18n();

    return (
        <View className="flex-row items-start gap-3 border-b border-ink/5 px-4 py-4">
            {account.avatarUrl.length > 0 ? (
                <Avatar uri={account.avatarUrl} size={40} />
            ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-surface-1">
                    <ProfileIcon size={20} className="text-ink/40" />
                </View>
            )}

            <View className="flex-1 gap-0.5">
                <View className="flex-row items-start gap-2">
                    <View className="flex-1">
                        <Text
                            size="small"
                            numberOfLines={1}
                            className="font-semibold"
                        >
                            {account.fullName || account.username}
                        </Text>
                        <Text size="small" tone="subtle" numberOfLines={1}>
                            @{account.username}
                        </Text>
                    </View>

                    <Button
                        label={
                            isFollowing
                                ? t("profile.following")
                                : t("profile.follow")
                        }
                        size="sm"
                        variant={isFollowing ? "outline" : "primary"}
                        loading={isPending}
                        onPress={() => onToggle(account.userId)}
                    />
                </View>

                {/* Bot bios open with an emoji and a headline and then run on
                    for a paragraph, so the row clamps rather than grows. */}
                {account.bio ? (
                    <Text size="caption" tone="muted" numberOfLines={2}>
                        {account.bio}
                    </Text>
                ) : null}

                <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                    <Text size="caption" tone="subtle">
                        {account.followersCount}{" "}
                        {account.followersCount === 1
                            ? t("profile.follower")
                            : t("profile.followerPlural")}
                    </Text>

                    {/* Why this account is on the list. The chips earn their
                        place when two fields were picked and the rows look
                        interleaved for no visible reason. */}
                    {account.categories.map((category) => {
                        const labelKey = CATEGORY_LABELS.get(category);

                        if (!labelKey) return null;

                        return (
                            <View
                                key={category}
                                className="rounded-full border border-ink/10 bg-ink/[0.06] px-2 py-0.5"
                            >
                                <Text
                                    size="caption"
                                    tone="subtle"
                                    className="font-medium"
                                >
                                    {t(labelKey)}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

/** Rows are recycled by the list; a suggestion does not change in place. */
export const AccountCard = memo(AccountCardView);
