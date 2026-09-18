import { Pressable, View } from "react-native";
import { memo } from "react";
import { useRouter } from "expo-router";

import { Avatar } from "@shared/ui/Avatar";
import type { Conversation } from "../../data/message.types";
import { formatBadgeCount } from "@shared/utils/badge-count";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface ConversationRowProps {
    conversation: Conversation;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatWhen(iso: string, locale: string): string {
    let formatter = formatters.get(locale);

    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
        });
        formatters.set(locale, formatter);
    }

    return formatter.format(new Date(iso));
}

/**
 * One line of the inbox.
 *
 * The preview is the server's truncation, shown as it arrives. Shortening it
 * here would disagree with the copy realtime writes into the same field, and
 * the row would change wording every time it was refetched.
 *
 * Opens the thread, which is what the row was waiting for — the previous
 * version deliberately answered nothing, because the screen did not exist yet.
 */
function ConversationRowView({ conversation }: ConversationRowProps) {
    const { t, locale } = useI18n();
    const router = useRouter();
    const { participant, unreadCount, lastMessagePreview, lastMessageAt } =
        conversation;

    const isUnread = unreadCount > 0;
    const badge = formatBadgeCount(unreadCount);

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={participant.username}
            onPress={() =>
                router.push({
                    pathname: "/messages/[id]",
                    params: { id: conversation.id },
                })
            }
            className="flex-row items-center gap-3 border-b border-ink/10 px-4 py-3 active:bg-ink/5"
        >
            {/*
             * Truthiness, not `.length`. The field is NOT NULL server-side and
             * typed as a string, but this branch exists because a missing
             * avatar is an expected shape — and reading `.length` off the
             * thing being guarded turns one absent URL into a `TypeError` that
             * takes the whole list down with the row.
             */}
            {participant.avatarUrl ? (
                <Avatar uri={participant.avatarUrl} size={48} />
            ) : (
                <View className="h-12 w-12 items-center justify-center rounded-full border border-ink/10 bg-surface-2">
                    <ProfileIcon size={22} className="text-ink/40" />
                </View>
            )}

            <View className="min-w-0 flex-1 gap-0.5">
                <View className="flex-row items-baseline gap-2">
                    <Text
                        numberOfLines={1}
                        className="max-w-[60%] font-semibold"
                    >
                        {participant.fullName || participant.username}
                    </Text>
                    <Text size="caption" tone="subtle" numberOfLines={1}>
                        @{participant.username}
                    </Text>
                    {lastMessageAt && (
                        <Text
                            size="caption"
                            tone="subtle"
                            className="ml-auto shrink-0"
                        >
                            {formatWhen(lastMessageAt, locale)}
                        </Text>
                    )}
                </View>

                <Text
                    size="small"
                    tone={isUnread ? "default" : "muted"}
                    numberOfLines={1}
                    className={isUnread ? "font-semibold" : undefined}
                >
                    {lastMessagePreview ?? t("messages.startHint")}
                </Text>
            </View>

            {badge && (
                <View className="min-w-[20px] shrink-0 items-center justify-center rounded-full bg-accent-fill px-1.5 py-0.5">
                    <Text
                        tone="onFill"
                        className="text-[11px] font-bold leading-none"
                    >
                        {badge}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}

/**
 * Memoised because realtime rewrites one row at a time: an arriving message
 * replaces the conversation it belongs to and moves it to the front, leaving
 * every other row's object identical.
 */
export const ConversationRow = memo(ConversationRowView);
