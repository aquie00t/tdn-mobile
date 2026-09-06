import { View } from "react-native";
import type { ReactNode } from "react";

import { Text } from "./Text";

export interface EmptyStateProps {
    /** What is not here. One line. */
    title: string;
    /** Optional: what would put something here. */
    description?: string;
    /** An icon, or anything else that reads as a placeholder. */
    icon?: ReactNode;
}

/**
 * Nothing to show, and that is the correct answer.
 *
 * Separate from {@link ErrorState} on purpose: "you have not saved anything
 * yet" and "we could not load what you saved" look identical if they share a
 * component, and they are opposite instructions — one is finished, the other
 * wants retrying.
 *
 * On the web this is written inline in seven files, in two dialects, with a
 * hand-rolled circle and inline SVG repeated each time. One component here,
 * before there are twenty screens to go back and fix.
 */
export function EmptyState({ title, description, icon }: EmptyStateProps) {
    return (
        <View className="flex-1 items-center justify-center gap-3 p-12">
            {icon && (
                <View className="h-16 w-16 items-center justify-center rounded-full border border-ink/10 bg-ink/5">
                    {icon}
                </View>
            )}
            <Text tone="subtle" className="text-center italic">
                {title}
            </Text>
            {description && (
                <Text size="small" tone="subtle" className="text-center">
                    {description}
                </Text>
            )}
        </View>
    );
}
