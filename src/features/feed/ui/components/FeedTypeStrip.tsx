import { Pressable, View } from "react-native";

import type { FeedTab } from "../../data/feed.types";
import { Text } from "@shared/ui/Text";
import type { TranslationKey } from "@shared/i18n/translations";
import { useI18n } from "@shared/hooks/useI18n";

/**
 * The four the web's strip carries, in its order.
 *
 * `JOB_POSTING` is a post type but not a tab — it is not on the web's strip
 * either, and there is no translated label for it. Articles *is* a tab and is
 * not a post type: it names a separate resource with its own endpoint, which
 * is why the strip selects a `FeedTab` rather than a `PostType`. What the tab
 * shows is handed to the feed screen from outside, so this feature still
 * imports nothing from the article one.
 */
const TABS: { value: FeedTab; label: TranslationKey }[] = [
    { value: "COMMUNITY", label: "feed.community" },
    { value: "TECH_NEWS", label: "feed.news" },
    { value: "SYSTEM_UPDATE", label: "feed.updates" },
    { value: "ARTICLES", label: "feed.articles" },
];

export interface FeedTypeStripProps {
    active: FeedTab;
    onSelect: (tab: FeedTab) => void;
}

/**
 * Which feed is being read.
 *
 * An underline rather than a pill, so the strip reads as part of the list
 * below it rather than as a row of buttons floating over it — and so the
 * active tab is marked with `ink` itself, the same foreground the rows use.
 */
export function FeedTypeStrip({ active, onSelect }: FeedTypeStripProps) {
    const { t } = useI18n();

    return (
        <View className="flex-row border-b border-ink/10">
            {TABS.map((tab) => {
                const isActive = tab.value === active;

                return (
                    <Pressable
                        key={tab.value}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        onPress={() => onSelect(tab.value)}
                        className={
                            isActive
                                ? "flex-1 items-center border-b-2 border-ink py-3 active:bg-ink/5"
                                : // The inactive tabs carry the same 2px of
                                  // border in a colour that does not show, so
                                  // selecting one does not shift the row.
                                  "flex-1 items-center border-b-2 border-transparent py-3 active:bg-ink/5"
                        }
                    >
                        <Text
                            size="small"
                            tone={isActive ? "default" : "subtle"}
                            className={isActive ? "font-semibold" : undefined}
                        >
                            {t(tab.label)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
