import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@shared/ui/Button";
import { Screen } from "@shared/ui/Screen";
import { Text } from "@shared/ui/Text";
import { TextField } from "@shared/ui/TextField";
import { authApi } from "../../data/auth.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { isPendingDeletion, useAuthActions } from "../hooks/useAuthActions";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";

export function LoginScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const identifier = useAuthFlowStore((s) => s.identifier);
    const setRecoveryToken = useAuthFlowStore((s) => s.setRecoveryToken);
    const { acceptSession } = useAuthActions();

    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /** An identifier is a username or an email; only the former is a handle. */
    const displayIdentifier = identifier.includes("@")
        ? identifier
        : `@${identifier}`;

    const handleLogin = async () => {
        if (!password) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await authApi.login(identifier, password);
            await acceptSession(data);
        } catch (err) {
            // Not a wrong password, so not an error under the field: the
            // account exists, the password was right, and it is scheduled for
            // deletion. The token in that 403 is the only thing that undoes
            // it, and it lives fifteen minutes — so this goes straight to the
            // screen that can spend it rather than reporting a dead end.
            if (isPendingDeletion(err)) {
                setRecoveryToken(err.recoveryToken);
                setIsLoading(false);
                router.push("/(auth)/recover-account");
                return;
            }

            setError(getErrorMessage(err));
            setIsLoading(false);
        }
    };

    return (
        <Screen scroll className="px-6">
            <View className="gap-2 pb-8 pt-4">
                <Text size="display">{t("auth.passwordTitle")}</Text>
                <Text tone="muted">
                    {t("auth.loggingInAs")} {displayIdentifier}
                </Text>
            </View>

            <View className="gap-4">
                <TextField
                    value={password}
                    onChangeText={(next) => {
                        setPassword(next);
                        // Drop the error once it is being corrected — leaving
                        // it under a field somebody is retyping reads as a
                        // verdict on what they are typing now.
                        if (error) setError(null);
                    }}
                    placeholder={t("auth.passwordPlaceholder")}
                    error={error}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={() => void handleLogin()}
                />

                <Text
                    size="small"
                    tone="accent"
                    onPress={() => router.push("/(auth)/forgot-password")}
                >
                    {t("auth.forgotPassword")}
                </Text>

                <Button
                    label={isLoading ? t("auth.loggingIn") : t("auth.login")}
                    size="full"
                    loading={isLoading}
                    disabled={!password}
                    onPress={() => void handleLogin()}
                />

                <Button
                    label={t("auth.changeAccount")}
                    variant="ghost"
                    size="full"
                    onPress={() => router.back()}
                />
            </View>
        </Screen>
    );
}
