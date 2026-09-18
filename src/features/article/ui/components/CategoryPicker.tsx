import { Pressable, View } from "react-native";

import { ARTICLE_LIMITS } from "../../domain/draft";
import { CATEGORY_OPTIONS } from "@shared/constants/categories";
import type { CategoryValue } from "@shared/constants/categories";
import { Text } from "@shared/ui/Text";
import { cn } from "@shared/ui/cn";
import { useI18n } from "@shared/hooks/useI18n";

export interface CategoryPickerProps {
    selected: CategoryValue[];
    onChange: (categories: CategoryValue[]) => void;
}

/**
 * The five fields, as toggles.
 *
 * The same five, in the same order, as the feed's filter chips and the
 * onboarding picker — `CATEGORY_OPTIONS` exists so an article filed under a
 * field always has a chip to be found by.
 */
export function CategoryPicker({ selected, onChange }: CategoryPickerProps) {
    const { t } = useI18n();

    function toggle(value: CategoryValue) {
        if (selected.includes(value)) {
            onChange(selected.filter((it) => it !== value));
            return;
        }
        // Five categories and a cap of five, so this cannot bite today — but
        // the cap is the server's, not this list's.
        if (selected.length >= ARTICLE_LIMITS.categoriesMax) return;
        onChange([...selected, value]);
    }

    return (
        <View className="gap-2">
            <View className="flex-row flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(({ labelKey, value, Icon }) => {
                    const isOn = selected.includes(value);

                    return (
                        <Pressable
                            key={value}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isOn }}
                            onPress={() => toggle(value)}
                            className={cn(
                                "flex-row items-center gap-1.5 rounded-full px-3 py-1.5",
                                isOn
                                    ? "bg-ink active:bg-ink-hover"
                                    : "bg-ink/10 active:bg-ink/15",
                            )}
                        >
                            <Icon
                                size={13}
                                className={isOn ? "text-ground" : "text-ink/60"}
                            />
                            <Text
                                size="caption"
                                className={cn(
                                    "font-medium",
                                    isOn ? "text-ground" : "text-ink/70",
                                )}
                            >
                                {t(labelKey)}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
            <Text size="caption" tone="subtle">
                {t("editor.categoriesHint", {
                    max: ARTICLE_LIMITS.categoriesMax,
                })}
            </Text>
        </View>
    );
}
