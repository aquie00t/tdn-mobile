import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AUTH_LIMITS } from "../../data/auth.types";
import { Button } from "@shared/ui/Button";
import { Logo } from "@shared/ui/Logo";
import { Screen } from "@shared/ui/Screen";
import { SocialButtons } from "../components/SocialButtons";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { TextField } from "@shared/ui/TextField";
import { authApi } from "../../data/auth.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";
import { useOAuth } from "../hooks/useOAuth";

export function IdentifierScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const setIdentifier = useAuthFlowStore((s) => s.setIdentifier);
    const oauth = useOAuth();

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
        <Screen className="px-6">
            {/*
             * Three bands: the mark sits at the top where a brand belongs, the
             * form takes the middle and is centred in whatever is left, and the
             * terms sit at the bottom. The middle is `flex-1`, so the form
             * stays optically centred on a small phone and on a tall one
             * without either being measured.
             */}
            <View className="items-center pb-2 pt-6">
                <Logo size={44} />
            </View>

            <View className="flex-1 justify-center gap-6 pb-10">
                <Text size="display" className="text-center">
                    {t("auth.joinTitle")}
                </Text>

                <View className="gap-4">
                    <TextField
                        value={value}
                        onChangeText={(next) => {
                            setValue(next);
                            if (error) setError(null);
                        }}
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
                        disabled={!value.trim() || oauth.pending !== null}
                        onPress={() => void handleNext()}
                    />
                </View>

                <SocialButtons
                    onSelect={(provider) => void oauth.signInWith(provider)}
                    pending={oauth.pending}
                    disabled={isLoading}
                />

                {/*
                 * Below the buttons rather than under the field: this is a
                 * verdict on a flow that happened in a browser, and putting it
                 * where the identifier's own errors go would read as a verdict
                 * on what has been typed there.
                 */}
                {oauth.error && (
                    <Text size="small" tone="danger" className="text-center">
                        {oauth.error}
                    </Text>
                )}
            </View>

            <Text size="caption" tone="subtle" className="pb-4 text-center">
                {t("auth.termsPrefix")} {t("auth.terms")} {t("auth.and")}{" "}
                {t("auth.privacy")}
                {t("auth.termsSuffix")}
            </Text>

            {/*
             * The gap between the browser closing and the session existing.
             * The provider's sheet has gone, the app is exchanging a code, and
             * without this the screen looks idle at the one moment somebody is
             * most likely to press something again.
             */}
            {oauth.isExchanging && (
                <View className="absolute inset-0 items-center justify-center gap-4 bg-ground/95">
                    <Spinner size="large" />
                    <Text tone="subtle">{t("common.syncingAccount")}</Text>
                </View>
            )}
        </Screen>
    );
}
