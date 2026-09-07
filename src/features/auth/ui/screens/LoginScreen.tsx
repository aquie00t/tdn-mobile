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
            // Told apart from a wrong password, because it is not one — the
            // account exists and is scheduled for deletion. Recovery itself
            // needs an API fix that lands with OAuth.
            setError(
                isPendingDeletion(err)
                    ? t("auth.recoverySubtitle")
                    : getErrorMessage(err),
            );
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
