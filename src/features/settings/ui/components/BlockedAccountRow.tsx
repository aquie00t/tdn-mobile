import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import type { BlockedUser } from "@shared/data/block.types";
import { Button } from "@shared/ui/Button";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface BlockedAccountRowProps {
    user: BlockedUser;
    /** This row's unblock is the request in flight. */
    isPending: boolean;
    /** Some row's unblock is in flight — one at a time, as the hook allows. */
    isDisabled: boolean;
    onUnblock: (userId: string) => void;
}

/**
 * One blocked account, and the way back to it.
 *
 * The row still opens the profile, which is served to a blocked viewer on
 * purpose — it is where "You blocked @handle" and the same unblock button are.
 */
export function BlockedAccountRow({
    user,
    isPending,
    isDisabled,
    onUnblock,
}: BlockedAccountRowProps) {
    const { t } = useI18n();
    const router = useRouter();

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() =>
                router.push({
                    pathname: "/profile/[username]",
                    params: { username: user.username },
                })
            }
            className="flex-row items-center gap-3"
        >
            {user.avatarUrl.length > 0 ? (
                <Avatar uri={user.avatarUrl} size={40} />
            ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-surface-1">
                    <ProfileIcon size={20} className="text-ink/40" />
                </View>
            )}

            <View className="flex-1 gap-0.5">
                <Text size="small" numberOfLines={1} className="font-semibold">
                    {user.fullName || user.username}
                </Text>
                <Text size="caption" tone="subtle" numberOfLines={1}>
                    @{user.username}
                </Text>
            </View>

            <Button
                label={isPending ? t("block.working") : t("block.unblock")}
                variant="outline"
                size="sm"
                loading={isPending}
                disabled={isDisabled}
                onPress={() => onUnblock(user.userId)}
            />
        </Pressable>
    );
}
