import { Pressable, View } from "react-native";
import { memo } from "react";

import { TagIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import type { Trend } from "../../data/trends.types";
import { useI18n } from "@shared/hooks/useI18n";

export interface TrendCardProps {
    trend: Trend;
    onPress: (tag: string) => void;
}

/**
 * One tile in the trending grid.
 *
 * Half the row, as on the web, which is what lets the tag itself stay big
 * enough to read at a glance — a full-width row of these would be a list of
 * one-word lines with nothing to look at.
 */
function TrendCardView({ trend, onPress }: TrendCardProps) {
    const { t, locale } = useI18n();

    return (
        <Pressable
            accessibilityRole="button"
            onPress={() => onPress(trend.tag)}
            className="w-[48%] gap-1 rounded-2xl border border-ink/10 bg-surface-1 px-4 py-4 active:bg-ink/5"
        >
            {/* Nullable in the schema, so it is a branch rather than a line
                that renders an empty row of its own. */}
            {trend.category ? (
                <Text size="caption" tone="subtle">
                    {trend.category}
                </Text>
            ) : null}

            <View className="flex-row items-center gap-1.5">
                <TagIcon size={14} className="text-accent" />
                <Text size="small" numberOfLines={1} className="font-semibold">
                    {trend.tag}
                </Text>
            </View>

            <Text size="caption" tone="subtle">
                {trend.postCount.toLocaleString(locale)} {t("trending.posts")}
            </Text>
        </Pressable>
    );
}

/** The grid redraws whenever the search box changes; the tiles do not. */
export const TrendCard = memo(TrendCardView);
