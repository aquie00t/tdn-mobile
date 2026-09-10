import { Pressable, View } from "react-native";

import { PendingIcon, RefreshIcon } from "./icons/lucide";
import { Text } from "./Text";
import { useI18n } from "../hooks/useI18n";

export interface PendingMediaProps {
    /**
     * Omitted where there is nothing to refresh into — the embedded card of a
     * quote reads a post the list does not own, so it shows the wait without
     * offering to end it.
     */
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

/**
 * Stands in for a video that is uploaded but not yet checked.
 *
 * The post arrives with `mediaUrls: []` while this is true, which is
 * indistinguishable from a post that never had media — `mediaPending` is the
 * only thing that tells them apart, so this placeholder is the only signal
 * that anything is coming.
 *
 * Checking runs about once a minute, so the wait is short but long enough that
 * an author who sees nothing assumes their post failed.
 */
export function PendingMedia({ onRefresh, isRefreshing }: PendingMediaProps) {
    const { t } = useI18n();

    return (
        <View className="items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-surface-1 px-4 py-8">
            <PendingIcon size={20} className="text-ink/40" />
            <Text size="small" tone="muted">
                {t("media.processing")}
            </Text>

            {onRefresh && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !!isRefreshing }}
                    disabled={isRefreshing}
                    onPress={onRefresh}
                    className="mt-1 flex-row items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 active:bg-ink/5"
                >
                    {/*
                     * The web spins this icon while the check runs. There is no
                     * CSS animation here and one turning icon is not worth a
                     * Reanimated worklet, so the button simply dims instead —
                     * which is also what says it cannot be pressed again.
                     */}
                    <RefreshIcon
                        size={13}
                        className={isRefreshing ? "text-ink/40" : "text-ink/70"}
                    />
                    <Text
                        size="caption"
                        tone={isRefreshing ? "subtle" : "muted"}
                        className="font-semibold"
                    >
                        {t("media.refresh")}
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
