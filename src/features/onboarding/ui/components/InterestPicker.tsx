import { Pressable, View } from "react-native";

import { CATEGORY_OPTIONS } from "@shared/constants/categories";
import type { CategoryValue } from "@shared/constants/categories";
import { CheckIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { cn } from "@shared/ui/cn";
import { useI18n } from "@shared/hooks/useI18n";

export interface InterestPickerProps {
    selected: CategoryValue[];
    onToggle: (category: CategoryValue) => void;
}

/**
 * The five fields, as tiles.
 *
 * Two columns rather than the web's two-to-three, and the widths are
 * percentages on a wrapping row: a phone has one breakpoint, and a grid of
 * three would put the labels on two lines each. Five into two leaves the last
 * tile half-width, which reads as the end of a list rather than as a gap.
 *
 * `CATEGORY_OPTIONS` is the shared list, so these are the same five the feed
 * filters by, in the same order — a field chosen here always has a chip to
 * match it later.
 */
export function InterestPicker({ selected, onToggle }: InterestPickerProps) {
    const { t } = useI18n();

    return (
        <View className="flex-row flex-wrap gap-3">
            {CATEGORY_OPTIONS.map(({ labelKey, value, Icon }) => {
                const isSelected = selected.includes(value);

                return (
                    <Pressable
                        key={value}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isSelected }}
                        onPress={() => onToggle(value)}
                        className={cn(
                            "w-[48%] items-center gap-2 rounded-2xl border p-5",
                            isSelected
                                ? "border-ink bg-ink/10"
                                : "border-ink/10 bg-ink/[0.03] active:border-ink/25",
                        )}
                    >
                        {isSelected && (
                            <View className="absolute right-2 top-2 h-5 w-5 items-center justify-center rounded-full bg-ink">
                                {/* `ground` on `ink`, the pair the primary
                                    button uses: both halves swap together, so
                                    the tick stays legible on either theme. */}
                                <CheckIcon
                                    size={13}
                                    strokeWidth={3}
                                    className="text-ground"
                                />
                            </View>
                        )}

                        <Icon
                            size={24}
                            className={isSelected ? "text-ink" : "text-ink/60"}
                        />
                        <Text
                            size="small"
                            tone={isSelected ? "default" : "muted"}
                            className="font-medium"
                        >
                            {t(labelKey)}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
