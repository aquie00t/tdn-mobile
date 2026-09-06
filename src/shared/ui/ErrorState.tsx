import { View } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import { useI18n } from "../hooks/useI18n";

export interface ErrorStateProps {
    /** Already translated — usually `getErrorMessage(err)`. */
    message: string;
    /** Omitted when there is nothing useful to retry. */
    onRetry?: () => void;
    retryLabel?: string;
}

/**
 * Something failed, and trying again might work.
 *
 * The retry is `outline` at `sm`, which is the shape the web settled on for
 * exactly this and uses at 17 call sites — except in its page dialect, which
 * hand-writes the primary button's classes instead and drifts. One component
 * is how that stops happening.
 *
 * This renders *instead of* a list only when the list is empty. A page that
 * already has rows and fails to load the next one puts the failure **under**
 * them: a second page that never arrived must not take the first one with it.
 * That distinction is the caller's to make, and it is the most important one
 * in this file.
 */
export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps) {
    const { t } = useI18n();

    return (
        <View className="flex-1 items-center justify-center gap-4 p-10">
            <Text size="small" tone="danger" className="text-center">
                {message}
            </Text>
            {onRetry && (
                <Button
                    variant="outline"
                    size="sm"
                    label={retryLabel ?? t("common.tryAgain")}
                    onPress={onRetry}
                />
            )}
        </View>
    );
}
