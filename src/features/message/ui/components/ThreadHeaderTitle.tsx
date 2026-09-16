import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import type { ConversationParticipant } from "../../data/message.types";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";

export interface ThreadHeaderTitleProps {
    participant: ConversationParticipant;
}

/**
 * Who the conversation is with, at the top of it.
 *
 * A thread's header is about a *person*, not about a screen, so it carries
 * their face and handle rather than a line of text — and pressing it opens
 * their profile, which is the question anybody has two messages into a
 * conversation with a stranger. The first version was the name alone, with no
 * way through to the account it named.
 *
 * The profile opens in the Home tab's stack, where `/profile/[username]`
 * lives; the notification list and the tag view make the same jump.
 */
export function ThreadHeaderTitle({ participant }: ThreadHeaderTitleProps) {
    const router = useRouter();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={participant.username}
            onPress={() =>
                router.push({
                    pathname: "/profile/[username]",
                    params: { username: participant.username },
                })
            }
            className="ml-1 flex-1 flex-row items-center gap-2.5 rounded-full py-1 pr-2 active:bg-ink/5"
        >
            {participant.avatarUrl ? (
                <Avatar uri={participant.avatarUrl} size={36} />
            ) : (
                <View className="h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-surface-2">
                    <ProfileIcon size={18} className="text-ink/40" />
                </View>
            )}

            <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-semibold">
                    {participant.fullName || participant.username}
                </Text>
                <Text size="caption" tone="subtle" numberOfLines={1}>
                    @{participant.username}
                </Text>
            </View>
        </Pressable>
    );
}
