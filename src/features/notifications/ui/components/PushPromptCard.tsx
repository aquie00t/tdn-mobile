import { View } from "react-native";

import { Button } from "@shared/ui/Button";
import { NotificationsIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface PushPromptCardProps {
    /** Whether the OS dialog is up, so the button can say so. */
    isAsking: boolean;
    onEnable: () => void;
    onDismiss: () => void;
}

/**
 * The one place the notification permission is asked for.
 *
 * A card at the top of the list rather than a modal over it. A modal would
 * arrive between the reader and the thing they opened the screen to read,
 * which is the shape of the dialog people dismiss without reading — and the
 * dismissal here is permanent, because Android only shows its dialog once.
 *
 * It sits above notifications that already exist, which is the whole argument
 * it makes: these, on your lock screen, while the app is closed.
 */
export function PushPromptCard({
    isAsking,
    onEnable,
    onDismiss,
}: PushPromptCardProps) {
    const { t } = useI18n();

    return (
        <View className="m-4 gap-3 rounded-2xl border border-ink/10 bg-surface-1 p-4">
            <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <NotificationsIcon size={20} className="text-accent" />
                </View>
                <Text size="lead" className="flex-1 font-semibold">
                    {t("push.promptTitle")}
                </Text>
            </View>

            <Text size="small" tone="muted">
                {t("push.promptBody")}
            </Text>

            <View className="flex-row items-center justify-end gap-2">
                <Button
                    label={t("push.notNow")}
                    variant="ghost"
                    size="sm"
                    disabled={isAsking}
                    onPress={onDismiss}
                />
                <Button
                    label={t("push.enable")}
                    size="sm"
                    loading={isAsking}
                    onPress={onEnable}
                />
            </View>
        </View>
    );
}
