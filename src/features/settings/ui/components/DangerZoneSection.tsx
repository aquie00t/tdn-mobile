import { useState } from "react";
import { View } from "react-native";
import type { ReactNode } from "react";

import { Button } from "@shared/ui/Button";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { SettingsSection } from "./SettingsSection";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface DangerZoneSectionProps {
    onSignOut: () => void;
    onAccountDeleted: () => Promise<void>;
}

/** The two ways out: of this phone, and of the network. */
export function DangerZoneSection({
    onSignOut,
    onAccountDeleted,
}: DangerZoneSectionProps) {
    const { t } = useI18n();
    const [isConfirming, setIsConfirming] = useState(false);

    return (
        <SettingsSection title={t("settings.dangerZone")}>
            <Row
                title={t("settings.logOut")}
                subtitle={t("settings.logOutSubtitle")}
                action={
                    <Button
                        label={t("settings.logOut")}
                        variant="outline"
                        size="sm"
                        onPress={onSignOut}
                    />
                }
            />

            <View className="border-t border-ink/10 pt-3">
                <Row
                    title={t("settings.deleteAccount")}
                    subtitle={t("settings.deleteAccountSubtitle")}
                    isDestructive
                    action={
                        <Button
                            label={t("settings.delete")}
                            variant="dangerOutline"
                            size="sm"
                            onPress={() => setIsConfirming(true)}
                        />
                    }
                />
            </View>

            <DeleteAccountDialog
                visible={isConfirming}
                onClose={() => setIsConfirming(false)}
                onDeleted={onAccountDeleted}
            />
        </SettingsSection>
    );
}

function Row({
    title,
    subtitle,
    action,
    isDestructive = false,
}: {
    title: string;
    subtitle: string;
    action: ReactNode;
    isDestructive?: boolean;
}) {
    return (
        <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1 gap-0.5">
                <Text
                    size="small"
                    tone={isDestructive ? "danger" : "default"}
                    className="font-medium"
                >
                    {title}
                </Text>
                <Text size="caption" tone="subtle">
                    {subtitle}
                </Text>
            </View>
            {action}
        </View>
    );
}
