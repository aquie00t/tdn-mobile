import { useState } from "react";
import { View } from "react-native";

import { AUTH_LIMITS, OTP_PATTERN } from "@shared/data/account-rules";
import { Button } from "@shared/ui/Button";
import { FormStatus } from "./FormStatus";
import { SettingsSection } from "./SettingsSection";
import { Text } from "@shared/ui/Text";
import { TextField } from "@shared/ui/TextField";
import { useEmailVerification } from "../hooks/useEmailVerification";
import { useI18n } from "@shared/hooks/useI18n";

export interface VerifyEmailSectionProps {
    onVerified: () => void;
}

/**
 * Shown only while the address is unverified: after skipping the step at sign
 * up, or straight after changing the address.
 */
export function VerifyEmailSection({ onVerified }: VerifyEmailSectionProps) {
    const { t } = useI18n();
    const [code, setCode] = useState("");
    const { hasSent, isSending, isVerifying, error, send, verify, clearError } =
        useEmailVerification(onVerified);

    const isComplete = code.length === AUTH_LIMITS.otpLength;

    const handleVerify = () => {
        if (!isComplete || isVerifying) return;
        void verify(code);
    };

    const sendLabel = isSending ? t("settings.sendingCode") : null;

    return (
        <SettingsSection
            title={t("settings.verifyEmail")}
            subtitle={t("settings.verifyEmailBody")}
        >
            {!hasSent ? (
                <View className="items-start gap-2">
                    <Button
                        label={sendLabel ?? t("settings.sendVerification")}
                        size="sm"
                        loading={isSending}
                        onPress={() => void send()}
                    />
                    <FormStatus error={error} success={null} />
                </View>
            ) : (
                <View className="gap-3">
                    <Text size="small" tone="success">
                        {t("settings.codeSent")}
                    </Text>

                    <TextField
                        value={code}
                        onChangeText={(next) => {
                            // Digits only, so a pasted code carrying a space
                            // or a stray dash still lands as eight digits.
                            setCode(
                                next
                                    .split("")
                                    .filter((c) => OTP_PATTERN.test(c))
                                    .join(""),
                            );
                            clearError();
                        }}
                        placeholder={t("settings.codeInputPlaceholder")}
                        error={error}
                        keyboardType="number-pad"
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        maxLength={AUTH_LIMITS.otpLength}
                        className="text-center text-lg tracking-[6px]"
                        returnKeyType="go"
                        onSubmitEditing={handleVerify}
                    />

                    <View className="flex-row gap-2">
                        <Button
                            label={
                                isVerifying
                                    ? t("settings.verifying")
                                    : t("settings.verify")
                            }
                            size="sm"
                            loading={isVerifying}
                            disabled={!isComplete}
                            onPress={handleVerify}
                        />
                        <Button
                            label={sendLabel ?? t("settings.resend")}
                            variant="outline"
                            size="sm"
                            loading={isSending}
                            onPress={() => void send()}
                        />
                    </View>
                </View>
            )}
        </SettingsSection>
    );
}
