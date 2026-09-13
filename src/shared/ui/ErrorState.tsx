import { View } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";
import { readerFacingMessage } from "../utils/report-error";
import { useI18n } from "../hooks/useI18n";

export interface ErrorStateProps {
    /** Usually `getErrorMessage(err)`. See `readerFacingMessage` for what shows. */
    message: string;
    /** Omitted when there is nothing useful to retry. */
    onRetry?: () => void;
    retryLabel?: string;
}

/**
 * Something failed to load.
 *
 * **Our failures are not explained; the server's answers are.** A timeout or a
 * 500 becomes "could not load" with a retry beside it — the reason is ours, and
 * a development build shows it. A deleted post or a rate limit is shown as the
 * server said it, because a retry cannot fix either and the reader needs to
 * know that. `readerFacingMessage` draws the line.
 *
 * The retry is `outline` at `sm`, which is the shape the web settled on for
 * exactly this.
 *
 * This renders *instead of* a list only when the list is empty. A page that
 * already has rows and fails to load the next one puts the failure **under**
 * them: a second page that never arrived must not take the first one with it.
 * That distinction is the caller's to make.
 */
export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps) {
    const { t } = useI18n();

    return (
        <View className="flex-1 items-center justify-center gap-4 p-10">
            <Text size="small" tone="subtle" className="text-center">
                {readerFacingMessage(message)}
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
