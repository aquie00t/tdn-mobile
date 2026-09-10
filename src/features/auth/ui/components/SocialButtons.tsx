import { View } from "react-native";

import { Button } from "@shared/ui/Button";
import { Text } from "@shared/ui/Text";
import type { OAuthProvider } from "../../data/oauth.types";
import { useI18n } from "@shared/hooks/useI18n";

export interface SocialButtonsProps {
    onSelect: (provider: OAuthProvider) => void;
    /** The provider mid-flow, if any: only that button shows a spinner. */
    pending?: OAuthProvider | null;
    /** Set while anything else on the screen is working. */
    disabled?: boolean;
}

/**
 * The other two ways in, under a divider.
 *
 * `outline` rather than `primary`: the filled button on this screen is the one
 * that continues with what has been typed, and two competing fills would leave
 * neither of them reading as the main action.
 *
 * The labels say "sign up" in both languages, which is the web's wording and
 * is kept — a provider sign-in creates the account when there is none, so the
 * button really does do both and the shorter half would be a lie half the
 * time.
 */
export function SocialButtons({
    onSelect,
    pending = null,
    disabled = false,
}: SocialButtonsProps) {
    const { t } = useI18n();

    return (
        <View className="gap-4">
            <View className="flex-row items-center gap-3">
                <View className="h-px flex-1 bg-ink/10" />
                <Text size="small" tone="subtle">
                    {t("auth.or")}
                </Text>
                <View className="h-px flex-1 bg-ink/10" />
            </View>

            <View className="gap-3">
                <Button
                    label={t("auth.googleSignUp")}
                    variant="outline"
                    size="full"
                    loading={pending === "google"}
                    disabled={disabled || pending !== null}
                    onPress={() => onSelect("google")}
                />

                <Button
                    label={t("auth.githubSignUp")}
                    variant="outline"
                    size="full"
                    loading={pending === "github"}
                    disabled={disabled || pending !== null}
                    onPress={() => onSelect("github")}
                />
            </View>
        </View>
    );
}
