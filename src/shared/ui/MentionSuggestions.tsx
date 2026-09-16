import { Pressable, View } from "react-native";

import { Avatar } from "./Avatar";
import { ProfileIcon } from "./icons/lucide";
import type { ProfileSearchItem } from "../data/profile-search.types";
import { Spinner } from "./Spinner";
import { Text } from "./Text";
import { useI18n } from "../hooks/useI18n";

export interface MentionSuggestionsProps {
    isSearching: boolean;
    suggestions: ProfileSearchItem[];
    onSelect: (item: ProfileSearchItem) => void;
}

/**
 * The accounts matching an `@handle` being typed.
 *
 * Drawn in the composer's own layout rather than floated at the caret — see
 * `useMentionAutocomplete` for why. A spinner row stands in while the first
 * answer for a query is on its way; the previous rows are not kept under it,
 * because they belong to a different query.
 */
export function MentionSuggestions({
    isSearching,
    suggestions,
    onSelect,
}: MentionSuggestionsProps) {
    const { t } = useI18n();

    return (
        <View
            accessibilityLabel={t("mention.suggestions")}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-surface-1"
        >
            {isSearching && suggestions.length === 0 ? (
                <View className="flex-row items-center gap-2 px-3 py-2.5">
                    <Spinner size="small" />
                    <Text size="small" tone="subtle">
                        {t("mention.searching")}
                    </Text>
                </View>
            ) : (
                suggestions.map((item) => (
                    <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`@${item.username}`}
                        onPress={() => onSelect(item)}
                        className="flex-row items-center gap-3 px-3 py-2 active:bg-ink/5"
                    >
                        {item.avatarUrl.length > 0 ? (
                            <Avatar uri={item.avatarUrl} size={28} />
                        ) : (
                            <View className="h-7 w-7 items-center justify-center rounded-full border border-ink/10 bg-ground">
                                <ProfileIcon
                                    size={14}
                                    className="text-ink/40"
                                />
                            </View>
                        )}
                        <View className="flex-1">
                            <Text
                                size="small"
                                numberOfLines={1}
                                className="font-semibold"
                            >
                                {item.fullName || item.username}
                            </Text>
                            <Text
                                size="caption"
                                tone="subtle"
                                numberOfLines={1}
                            >
                                @{item.username}
                            </Text>
                        </View>
                    </Pressable>
                ))
            )}
        </View>
    );
}
