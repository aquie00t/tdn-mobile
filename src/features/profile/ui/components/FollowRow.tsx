import { Pressable, View } from "react-native";
import { memo } from "react";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import { Button } from "@shared/ui/Button";
import type { FollowUser } from "../../data/profile.types";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { useFollowAction } from "../hooks/useFollowAction";
import { useI18n } from "@shared/hooks/useI18n";

export interface FollowRowProps {
    user: FollowUser;
    onPatch: (userId: string, isFollowing: boolean) => void;
}

/**
 * One account in a follow list.
 *
 * The follow state is written back into the list rather than kept here, for
 * the reason every other row in this app does the same: a `FlatList` unmounts
 * a row as it leaves the window and mounts it again on the way back, so state
 * a row keeps itself is discarded and re-seeded from a stale copy.
 */
function FollowRowView({ user, onPatch }: FollowRowProps) {
    const { t } = useI18n();
    const router = useRouter();

    const { toggle, isLoading } = useFollowAction({
        account: user,
        isFollowing: user.isFollowing,
        onChange: (isFollowing) => onPatch(user.userId, isFollowing),
    });

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() =>
                router.push({
                    pathname: "/profile/[username]",
                    params: { username: user.username },
                })
            }
            className="flex-row items-center gap-3 border-b border-ink/5 px-4 py-3"
        >
            {user.avatarUrl.length > 0 ? (
                <Avatar uri={user.avatarUrl} size={40} />
            ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-surface-1">
                    <ProfileIcon size={20} className="text-ink/40" />
                </View>
            )}

            <View className="flex-1 gap-0.5">
                {user.fullName.length > 0 && (
                    <Text
                        size="small"
                        numberOfLines={1}
                        className="font-semibold"
                    >
                        {user.fullName}
                    </Text>
                )}
                <Text size="small" tone="subtle" numberOfLines={1}>
                    @{user.username}
                </Text>
                {user.bio.length > 0 && (
                    <Text size="caption" tone="subtle" numberOfLines={1}>
                        {user.bio}
                    </Text>
                )}
            </View>

            {/* Nothing to offer on your own row. */}
            {!user.isMe && (
                <Button
                    label={
                        user.isFollowing
                            ? t("profile.following")
                            : t("profile.follow")
                    }
                    size="sm"
                    variant={user.isFollowing ? "outline" : "primary"}
                    loading={isLoading}
                    onPress={() => void toggle()}
                />
            )}
        </Pressable>
    );
}

export const FollowRow = memo(FollowRowView);
