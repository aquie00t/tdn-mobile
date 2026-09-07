import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "@shared/ui/Button";
import { Screen } from "@shared/ui/Screen";
import { Text } from "@shared/ui/Text";
import { TextField } from "@shared/ui/TextField";
import { authApi } from "../../data/auth.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";

export function ForgotPasswordScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const identifier = useAuthFlowStore((s) => s.identifier);
    const setResetEmail = useAuthFlowStore((s) => s.setResetEmail);

    // Prefilled only when what was typed earlier is plausibly the address —
    // a username here would be sent as an email and rejected as malformed.
    const [email, setEmail] = useState(
        identifier.includes("@") ? identifier : "",
    );
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSend = async () => {
        const address = email.trim();
        if (!address.includes("@")) {
            setError(t("auth.invalidEmail"));
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            await authApi.forgotPassword(address);
            // Carried forward because `/auth/reset-password` wants the address
            // as well as the code; asking for it twice invites a typo that
            // comes back as "wrong code".
            setResetEmail(address);
            router.push("/(auth)/reset-password");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Screen scroll className="px-6">
            <View className="gap-2 pb-8 pt-4">
                <Text size="display">{t("auth.forgotTitle")}</Text>
                <Text tone="muted">{t("auth.forgotSubtitle")}</Text>
            </View>

            <View className="gap-4">
                <TextField
                    value={email}
                    onChangeText={(next) => {
                        setEmail(next);
                        if (error) setError(null);
                    }}
                    placeholder={t("auth.forgotEmailPlaceholder")}
                    error={error}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={() => void handleSend()}
                />

                <Button
                    label={isLoading ? t("auth.sending") : t("auth.sendCode")}
                    size="full"
                    loading={isLoading}
                    disabled={!email.trim()}
                    onPress={() => void handleSend()}
                />

                <Button
                    label={t("auth.backToLogin")}
                    variant="ghost"
                    size="full"
                    onPress={() => router.back()}
                />
            </View>
        </Screen>
    );
}
