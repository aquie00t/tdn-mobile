import { Pressable, View } from "react-native";

import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export type ProfileTab = "posts" | "articles";

const TABS: ProfileTab[] = ["posts", "articles"];

export interface ProfileTabsProps {
    tab: ProfileTab;
    onChange: (tab: ProfileTab) => void;
}

/**
 * What a profile shows under its header: the account's posts, or its
 * articles.
 *
 * The strip only chooses. What each tab draws belongs to the feature that
 * owns it — posts to the feed, articles to the article feature — and the route
 * puts them together, so this feature imports neither.
 */
export function ProfileTabs({ tab, onChange }: ProfileTabsProps) {
    const { t } = useI18n();

    return (
        <View className="flex-row border-b border-ink/10">
            {TABS.map((value) => (
                <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: tab === value }}
                    onPress={() => onChange(value)}
                    className="flex-1 items-center py-3"
                >
                    <Text
                        size="small"
                        tone={tab === value ? "default" : "subtle"}
                        className="font-medium"
                    >
                        {t(
                            value === "posts"
                                ? "profile.tabPosts"
                                : "profile.tabArticles",
                        )}
                    </Text>
                    {tab === value && (
                        <View className="absolute bottom-0 left-8 right-8 h-0.5 rounded-full bg-ink" />
                    )}
                </Pressable>
            ))}
        </View>
    );
}
