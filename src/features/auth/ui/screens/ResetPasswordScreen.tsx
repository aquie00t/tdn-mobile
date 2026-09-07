import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AUTH_LIMITS, OTP_PATTERN } from "../../data/auth.types";
import { Button } from "@shared/ui/Button";
import { Screen } from "@shared/ui/Screen";
import { Text } from "@shared/ui/Text";
import { TextField } from "@shared/ui/TextField";
import { authApi } from "../../data/auth.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";
import { useToastStore } from "@shared/store/toast.store";

export function ResetPasswordScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const resetEmail = useAuthFlowStore((s) => s.resetEmail);
    const addToast = useToastStore((s) => s.addToast);

    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleReset = async () => {
        if (otp.length !== AUTH_LIMITS.otpLength) {
            setError(t("auth.otpLengthError"));
            return;
        }
        if (newPassword.length < AUTH_LIMITS.passwordMin) {
            setError(t("auth.passwordTooShort"));
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            await authApi.resetPassword({
                email: resetEmail,
                otp,
                newPassword,
            });
            // The password is changed but no session was issued, so this ends
            // at the password screen with the account already named rather
            // than signing anybody in.
            addToast({ type: "success", message: t("auth.resetSuccess") });
            router.replace("/(auth)/login");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Screen scroll className="px-6">
            <View className="gap-2 pb-8 pt-4">
                <Text size="display">{t("auth.resetTitle")}</Text>
                <Text tone="muted">{t("auth.resetSubtitle")}</Text>
            </View>

            <View className="gap-4">
                <TextField
                    value={otp}
                    onChangeText={(next) => {
                        const digits = next
                            .split("")
                            .filter((c) => OTP_PATTERN.test(c))
                            .join("");
                        setOtp(digits);
                        if (error) setError(null);
                    }}
                    placeholder={t("auth.otpPlaceholder")}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={AUTH_LIMITS.otpLength}
                    className="text-center text-xl tracking-[8px]"
                />

                <TextField
                    value={newPassword}
                    onChangeText={(next) => {
                        setNewPassword(next);
                        if (error) setError(null);
                    }}
                    placeholder={t("auth.newPasswordPlaceholder")}
                    error={error}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password-new"
                    returnKeyType="go"
                    onSubmitEditing={() => void handleReset()}
                />

                <Button
                    label={
                        isLoading
                            ? t("auth.resetting")
                            : t("auth.updatePassword")
                    }
                    size="full"
                    loading={isLoading}
                    disabled={
                        otp.length !== AUTH_LIMITS.otpLength ||
                        newPassword.length < AUTH_LIMITS.passwordMin
                    }
                    onPress={() => void handleReset()}
                />

                <Button
                    label={t("auth.back")}
                    variant="ghost"
                    size="full"
                    onPress={() => router.back()}
                />
            </View>
        </Screen>
    );
}
