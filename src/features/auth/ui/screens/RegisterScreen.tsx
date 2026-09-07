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
import { useAuthActions } from "../hooks/useAuthActions";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";
import type { ApiErrorResponse } from "@core/api/api.types";

const FIELDS = ["email", "username", "password"] as const;
type Field = (typeof FIELDS)[number];

/**
 * Picks out the field the API rejected.
 *
 * A validation entry names it in `instancePath` ("/username") and never in the
 * message — "must NOT have fewer than 3 characters" reads identically whichever
 * field it came from, and the conflict on an existing account names no field at
 * all.
 */
export function fieldFromError(err: unknown): Field | null {
    if (!err || typeof err !== "object" || !("validation" in err)) return null;
    const path = (err as ApiErrorResponse).validation?.[0]?.instancePath ?? "";
    return FIELDS.find((field) => path === `/${field}`) ?? null;
}

export function RegisterScreen() {
    const { t } = useI18n();
    const router = useRouter();
    const identifier = useAuthFlowStore((s) => s.identifier);
    const setIdentifier = useAuthFlowStore((s) => s.setIdentifier);
    const { acceptSession } = useAuthActions();

    // Whatever was typed on the first screen is already one of the two fields.
    const looksLikeEmail = identifier.includes("@");
    const [email, setEmail] = useState(looksLikeEmail ? identifier : "");
    const [username, setUsername] = useState(looksLikeEmail ? "" : identifier);
    const [password, setPassword] = useState("");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorField, setErrorField] = useState<Field | null>(null);

    const clearError = () => {
        if (!error) return;
        setError(null);
        setErrorField(null);
    };

    const handleRegister = async () => {
        setIsLoading(true);
        setError(null);
        setErrorField(null);

        const payload = {
            email: email.trim(),
            username: username.trim(),
            password,
        };

        // Step one: create the account.
        try {
            await authApi.register(payload);
        } catch (err) {
            setError(getErrorMessage(err));
            setErrorField(fieldFromError(err));
            setIsLoading(false);
            return;
        }

        // Step two: sign it in, because register answers no session.
        //
        // The account exists from here on, so a failure below must not drop
        // anybody back on this form — resubmitting it can only ever answer 409.
        // The password is still in hand, so the login screen is the one place
        // that can finish the job.
        try {
            const data = await authApi.login(
                payload.username,
                payload.password,
            );
            await acceptSession(data);
        } catch {
            setIdentifier(payload.username);
            router.replace("/(auth)/login");
        } finally {
            setIsLoading(false);
        }
    };

    const canSubmit =
        email.trim().length > 0 &&
        username.trim().length >= AUTH_LIMITS.usernameMin &&
        password.length >= AUTH_LIMITS.passwordMin;

    return (
        <Screen scroll className="px-6">
            <View className="gap-2 pb-8 pt-4">
                <Text size="display">{t("auth.registerTitle")}</Text>
                <Text tone="muted">{t("auth.registerSubtitle")}</Text>
            </View>

            <View className="gap-4">
                <TextField
                    value={email}
                    onChangeText={(next) => {
                        setEmail(next);
                        clearError();
                    }}
                    placeholder={t("auth.emailPlaceholder")}
                    error={errorField === "email" ? error : null}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                />

                <TextField
                    value={username}
                    onChangeText={(next) => {
                        setUsername(next);
                        clearError();
                    }}
                    placeholder={t("auth.usernamePlaceholder")}
                    error={errorField === "username" ? error : null}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username-new"
                    maxLength={AUTH_LIMITS.usernameMax}
                />

                <TextField
                    value={password}
                    onChangeText={(next) => {
                        setPassword(next);
                        clearError();
                    }}
                    placeholder={t("auth.passwordPlaceholder")}
                    error={errorField === "password" ? error : null}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password-new"
                    returnKeyType="go"
                    onSubmitEditing={() => void handleRegister()}
                />

                {/* An error the API attributed to no field still has to be
                    readable — a 409 on an existing account names none. */}
                {error && !errorField && (
                    <Text size="small" tone="danger">
                        {error}
                    </Text>
                )}

                <Button
                    label={
                        isLoading
                            ? t("auth.creatingAccount")
                            : t("auth.register")
                    }
                    size="full"
                    loading={isLoading}
                    disabled={!canSubmit}
                    onPress={() => void handleRegister()}
                />
            </View>
        </Screen>
    );
}
