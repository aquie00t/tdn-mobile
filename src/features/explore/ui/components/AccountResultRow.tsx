import { Pressable, View } from "react-native";
import { memo } from "react";

import { Avatar } from "@shared/ui/Avatar";
import type { ProfileSearchItem } from "../../data/profile-search.types";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";

export interface AccountResultRowProps {
    account: ProfileSearchItem;
    onPress: (username: string) => void;
}

/**
 * One account in a set of results.
 *
 * No follow button, which is what the web's dropdown does too: a search result
 * is a way to somebody's profile, and a button that changes a relationship
 * from a list somebody is still scanning is a button pressed by accident.
 */
function AccountResultRowView({ account, onPress }: AccountResultRowProps) {
    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => onPress(account.username)}
            className="flex-row items-center gap-3 border-b border-ink/5 px-4 py-3 active:bg-ink/5"
        >
            {account.avatarUrl.length > 0 ? (
                <Avatar uri={account.avatarUrl} size={40} />
            ) : (
                <View className="h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-surface-1">
                    <ProfileIcon size={20} className="text-ink/40" />
                </View>
            )}

            <View className="flex-1">
                {account.fullName.length > 0 && (
                    <Text
                        size="small"
                        numberOfLines={1}
                        className="font-semibold"
                    >
                        {account.fullName}
                    </Text>
                )}
                <Text size="small" tone="subtle" numberOfLines={1}>
                    @{account.username}
                </Text>
            </View>
        </Pressable>
    );
}

export const AccountResultRow = memo(AccountResultRowView);
