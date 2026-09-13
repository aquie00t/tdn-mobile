import { View } from "react-native";
import type { ReactNode } from "react";

import { Text } from "@shared/ui/Text";

export interface SettingsSectionProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
}

/** One block of the settings page, divided from the next by a faint rule. */
export function SettingsSection({
    title,
    subtitle,
    children,
}: SettingsSectionProps) {
    return (
        <View className="gap-3 border-b border-ink/10 px-4 py-6">
            <View className="gap-1">
                <Text className="font-semibold">{title}</Text>
                {subtitle && (
                    <Text size="small" tone="subtle">
                        {subtitle}
                    </Text>
                )}
            </View>
            {children}
        </View>
    );
}
