import { Pressable, View } from "react-native";
import { memo } from "react";

import type { TagSearchItem } from "../../data/trends.types";
import { TagIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface TagResultRowProps {
    tag: TagSearchItem;
    onPress: (tag: string) => void;
}

function TagResultRowView({ tag, onPress }: TagResultRowProps) {
    const { t, locale } = useI18n();

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => onPress(tag.name)}
            className="flex-row items-center gap-2 border-b border-ink/5 px-4 py-3 active:bg-ink/5"
        >
            <TagIcon size={14} className="text-accent" />

            <View className="flex-1">
                <Text size="small" numberOfLines={1} className="font-semibold">
                    {tag.name}
                </Text>
                {tag.category ? (
                    <Text size="caption" tone="subtle">
                        {tag.category}
                    </Text>
                ) : null}
            </View>

            <Text size="caption" tone="subtle">
                {tag.postCount.toLocaleString(locale)} {t("trending.posts")}
            </Text>
        </Pressable>
    );
}

export const TagResultRow = memo(TagResultRowView);
