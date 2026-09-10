import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@shared/ui/Button";
import { Screen } from "@shared/ui/Screen";
import { Text } from "@shared/ui/Text";
import { authApi } from "../../data/auth.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { useAuthActions } from "../hooks/useAuthActions";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";

/**
 * The offer to undo a deletion, reached from the two places that are handed a
 * recovery token: a 403 from `/auth/login`, and an OAuth callback that came
 * back `account_pending_deletion`.
 *
 * Recovery re-authenticates exactly as login does, so it goes through
 * `acceptSession` and inherits the same verification prompt — an account that
 * never confirmed its address before it was deleted still has not, and letting
 * it past here would leave it inside the app with no route back to the code
 * screen.
 */
export function RecoverAccountScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const recoveryToken = useAuthFlowStore((s) => s.recoveryToken);
    const setRecoveryToken = useAuthFlowStore((s) => s.setRecoveryToken);
    const { acceptSession } = useAuthActions();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRecover = async () => {
        if (!recoveryToken) return;

        setIsLoading(true);
        // Cleared before the attempt, or a retry runs under the banner of the
        // one before it and a recovery that worked leaves "recovery failed" on
        // screen behind the next thing.
        setError(null);

        try {
            const session = await authApi.recoverAccount(recoveryToken);
            setRecoveryToken("");
            // Navigates on its own.
            await acceptSession(session);
        } catch (err) {
            // The API tells an expired token from a malformed one from a rate
            // limit. Answering all three with one guess tells somebody whose
            // problem is none of them to keep waiting.
            setError(getErrorMessage(err));
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        setRecoveryToken("");
        router.back();
    };

    return (
        <Screen scroll className="px-6">
            <View className="flex-1 items-center justify-center gap-6 py-10">
                {/*
                 * The web draws a warning triangle here. There is no SVG
                 * renderer in this app yet and one glyph is not a reason to
                 * add a native dependency, so the same weight is carried by
                 * the ring and the colour.
                 */}
                <View className="h-16 w-16 items-center justify-center rounded-full border border-danger/20 bg-danger/10">
                    <Text size="display" tone="danger">
                        !
                    </Text>
                </View>

                <View className="gap-2">
                    <Text size="display" className="text-center">
                        {t("auth.recoveryTitle")}
                    </Text>
                    <Text tone="subtle" className="text-center">
                        {t("auth.recoverySubtitle")}
                    </Text>
                </View>

                {error && (
                    <View className="w-full rounded-xl border border-danger/40 bg-danger/10 px-4 py-3">
                        <Text size="small" tone="danger">
                            {error}
                        </Text>
                    </View>
                )}

                <View className="w-full gap-3">
                    <Button
                        label={
                            isLoading
                                ? t("auth.recovering")
                                : t("auth.recoverAccount")
                        }
                        size="full"
                        loading={isLoading}
                        disabled={!recoveryToken}
                        onPress={() => void handleRecover()}
                    />

                    <Button
                        label={t("auth.recoveryBack")}
                        variant="ghost"
                        size="full"
                        disabled={isLoading}
                        onPress={handleBack}
                    />
                </View>

                <Text size="caption" tone="subtle" className="text-center">
                    {t("auth.recoveryExpiry")}
                </Text>
            </View>
        </Screen>
    );
}
