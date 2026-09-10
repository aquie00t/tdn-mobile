import { Pressable, ScrollView, View } from "react-native";

import { CATEGORY_OPTIONS } from "@shared/constants/categories";
import { FollowingIcon } from "@shared/ui/icons/lucide";
import type { LucideIcon } from "lucide-react-native";
import type { PostCategory } from "../../data/feed.types";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface FeedFilterRowProps {
    followedOnly: boolean;
    onToggleFollowedOnly: () => void;
    categories: PostCategory[];
    onToggleCategory: (category: PostCategory) => void;
}

/**
 * The two ways to narrow a feed: to the accounts you follow, and to the fields
 * you care about.
 *
 * Shown on News and Updates only — the same two tabs the web shows it on, and
 * the same two where it hides the composer. Both follow from who writes them:
 * those feeds are bot accounts, so "only the ones I follow" is a real cut,
 * while Community is everybody and the same chip would turn it into a second
 * tab. A reader on Community is offered the composer instead.
 *
 * The chips scroll horizontally rather than wrapping. Five fields plus the
 * follow toggle is about 420px of row, and wrapping them would push the first
 * post down by a line on every phone narrower than that.
 */
export function FeedFilterRow({
    followedOnly,
    onToggleFollowedOnly,
    categories,
    onToggleCategory,
}: FeedFilterRowProps) {
    const { t } = useI18n();

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // `grow-0` is load-bearing. A horizontal `ScrollView` inside a
            // column takes whatever height is left over, and the content
            // container's `items-center` then parks the chips in the middle of
            // it — so the row drifted downwards, and further still while the
            // list below was a full-height spinner. Told not to grow, it hugs
            // the chips.
            className="grow-0 border-b border-ink/10"
            contentContainerClassName="items-center gap-2 px-4 py-2"
        >
            <Chip
                icon={FollowingIcon}
                label={t("feed.following")}
                isActive={followedOnly}
                onPress={onToggleFollowedOnly}
            />

            {/* A rule, not a gap: the toggle asks a different question. */}
            <View className="h-4 w-px bg-ink/10" />

            {CATEGORY_OPTIONS.map((option) => (
                <Chip
                    key={option.value}
                    icon={option.Icon}
                    label={t(option.labelKey)}
                    isActive={categories.includes(option.value)}
                    onPress={() => onToggleCategory(option.value)}
                />
            ))}
        </ScrollView>
    );
}

function Chip({
    icon: Icon,
    label,
    isActive,
    onPress,
}: {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={onPress}
            className={
                isActive
                    ? "flex-row items-center gap-1.5 rounded-full bg-ink px-3 py-1.5"
                    : "flex-row items-center gap-1.5 rounded-full bg-ink/10 px-3 py-1.5 active:bg-ink/15"
            }
        >
            {/*
             * `ground` on a filled chip and a faded `ink` otherwise — the pair
             * swaps wholesale between themes, which is what keeps a selected
             * chip legible on both.
             */}
            <Icon
                size={13}
                className={isActive ? "text-ground" : "text-ink/60"}
            />
            <Text
                size="caption"
                className={
                    isActive
                        ? "font-medium text-ground"
                        : "font-medium text-ink/60"
                }
            >
                {label}
            </Text>
        </Pressable>
    );
}
