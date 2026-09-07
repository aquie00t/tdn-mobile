import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AUTH_LIMITS } from "../../data/auth.types";
import { Button } from "@shared/ui/Button";
import { Screen } from "@shared/ui/Screen";
import { Text } from "@shared/ui/Text";
import { TextField } from "@shared/ui/TextField";
import { authApi } from "../../data/auth.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";

export function IdentifierScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const setIdentifier = useAuthFlowStore((s) => s.setIdentifier);

    const [value, setValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleNext = async () => {
        // The API resolves an identifier by exact match, so a stray space or a
        // capitalised first letter — which phone keyboards hand out freely —
        // reads as an account that does not exist, and sends somebody off to
        // register one they already have. `autoCapitalize` below stops the
        // capital; this stops the space.
        const identifier = value.trim();
        if (!identifier) return;

        setIsLoading(true);
        setError(null);
        try {
            const response = await authApi.checkIdentifier(identifier);
            setIdentifier(identifier);
            // `check: true` means the account exists.
            router.push(response.check ? "/(auth)/login" : "/(auth)/register");
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Screen scroll className="px-6">
            <View className="gap-2 pb-8 pt-4">
                <Text size="display">{t("auth.joinTitle")}</Text>
            </View>

            <View className="gap-4">
                <TextField
                    value={value}
                    onChangeText={setValue}
                    placeholder={t("auth.identifierPlaceholder")}
                    error={error}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    keyboardType="email-address"
                    maxLength={AUTH_LIMITS.identifierMax}
                    returnKeyType="next"
                    onSubmitEditing={() => void handleNext()}
                />

                <Button
                    label={isLoading ? t("auth.checking") : t("auth.next")}
                    size="full"
                    loading={isLoading}
                    disabled={!value.trim()}
                    onPress={() => void handleNext()}
                />
            </View>

            <Text size="caption" tone="subtle" className="pt-8 text-center">
                {t("auth.termsPrefix")} {t("auth.terms")} {t("auth.and")}{" "}
                {t("auth.privacy")}
                {t("auth.termsSuffix")}
            </Text>
        </Screen>
    );
}
