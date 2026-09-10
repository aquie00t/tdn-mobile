import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { useSessionStore } from "@core/session/session.store";

export function VerifyEmailScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const updateUser = useSessionStore((s) => s.updateUser);
    const resetFlow = useAuthFlowStore((s) => s.reset);

    const [code, setCode] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // One code per arrival. A remount would otherwise send a second, spending
    // the account's rate-limit budget and — worse — invalidating the code the
    // reader is in the middle of typing in from their inbox.
    const hasRequestedCode = useRef(false);

    useEffect(() => {
        if (hasRequestedCode.current) return;
        hasRequestedCode.current = true;

        authApi.sendVerification().catch((err: unknown) => {
            setError(getErrorMessage(err));
        });
    }, []);

    const handleVerify = async () => {
        if (code.length !== AUTH_LIMITS.otpLength) {
            setError(t("auth.otpLengthError"));
            return;
        }
        setIsLoading(true);
        setError(null);
        setNotice(null);
        try {
            await authApi.verifyEmail(code);
            updateUser({ isEmailVerified: true });
            resetFlow();
            router.replace("/");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        setIsResending(true);
        setError(null);
        setNotice(null);
        try {
            await authApi.sendVerification();
            setNotice(t("auth.codeResent"));
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsResending(false);
        }
    };

    return (
        <Screen scroll className="px-6">
            <View className="gap-2 pb-8 pt-4">
                <Text size="display">{t("auth.verifyTitle")}</Text>
                <Text tone="muted">{t("auth.verifySubtitle")}</Text>
            </View>

            <View className="gap-4">
                <TextField
                    value={code}
                    onChangeText={(next) => {
                        // Digits only, so a pasted code carrying a space or a
                        // stray dash still lands as eight digits.
                        const digits = next
                            .split("")
                            .filter((c) => OTP_PATTERN.test(c))
                            .join("");
                        setCode(digits);
                        if (error) setError(null);
                    }}
                    placeholder={t("auth.otpPlaceholder")}
                    error={error}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    maxLength={AUTH_LIMITS.otpLength}
                    className="text-center text-xl tracking-[8px]"
                    returnKeyType="go"
                    onSubmitEditing={() => void handleVerify()}
                />

                {notice && (
                    <Text size="small" tone="success">
                        {notice}
                    </Text>
                )}

                <Button
                    label={
                        isLoading ? t("auth.verifying") : t("auth.verifyEmail")
                    }
                    size="full"
                    loading={isLoading}
                    disabled={code.length !== AUTH_LIMITS.otpLength}
                    onPress={() => void handleVerify()}
                />

                <Button
                    label={
                        isResending ? t("auth.resending") : t("auth.resendCode")
                    }
                    variant="ghost"
                    size="full"
                    loading={isResending}
                    onPress={() => void handleResend()}
                />

                {/*
                 * The session is already real — an unverified account is signed
                 * in, and the API gates almost nothing on the flag. So this is a
                 * prompt, not a gate, and leaving is allowed.
                 */}
                <Button
                    label={t("auth.skipForNow")}
                    variant="ghost"
                    size="full"
                    onPress={() => {
                        resetFlow();
                        router.replace("/");
                    }}
                />
            </View>
        </Screen>
    );
}
