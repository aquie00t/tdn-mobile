import { ScrollView, View } from "react-native";
import { useCallback, useEffect } from "react";

import { AccountInfoSection } from "../components/AccountInfoSection";
import { BlockedAccountsSection } from "../components/BlockedAccountsSection";
import { Button } from "@shared/ui/Button";
import { ChangeEmailSection } from "../components/ChangeEmailSection";
import { ChangePasswordSection } from "../components/ChangePasswordSection";
import { ChangeUsernameSection } from "../components/ChangeUsernameSection";
import { DangerZoneSection } from "../components/DangerZoneSection";
import type { Locale } from "@shared/store/language.store";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { SettingsSection } from "../components/SettingsSection";
import type { Theme } from "@shared/store/theme.store";
import type { TranslationKey } from "@shared/i18n/translations";
import { VerifyEmailSection } from "../components/VerifyEmailSection";
import { useAccountInfo } from "../hooks/useAccountInfo";
import { useI18n } from "@shared/hooks/useI18n";
import { useLanguageStore } from "@shared/store/language.store";
import { useTheme } from "@shared/hooks/useTheme";

const THEMES: { value: Theme; label: TranslationKey }[] = [
    { value: "dark", label: "settings.themeDark" },
    { value: "light", label: "settings.themeLight" },
    { value: "system", label: "settings.themeSystem" },
];

const LOCALES: { value: Locale; label: TranslationKey }[] = [
    { value: "en", label: "settings.english" },
    { value: "tr", label: "settings.turkish" },
];

export interface SettingsScreenProps {
    /**
     * Both wired by the route. Signing out means telling the server, which
     * means the auth feature's data layer — and a feature may not reach into
     * another, so the screen is handed the actions rather than finding them.
     */
    onSignOut: () => void;
    /** The same sign-out, awaited, after the account has been deleted. */
    onAccountDeleted: () => Promise<void>;
}

/**
 * The web's settings page, in its order. The blocked accounts sit under the
 * theme, where the web keeps them, and are the only way back to a block.
 *
 * The account is read once and every form writes its change back into that
 * copy, so the page agrees with itself without re-reading after each save. The
 * verification section follows the account rather than the session: it is the
 * server's answer to whether the address is verified, and the one a changed
 * email updates first.
 *
 * `keyboardShouldPersistTaps="handled"` is what lets the save button under a
 * focused field take the first tap. Without it the first tap only dismisses
 * the keyboard, and the form seems not to have heard.
 */
export function SettingsScreen({
    onSignOut,
    onAccountDeleted,
}: SettingsScreenProps) {
    const { t, locale } = useI18n();
    const { theme, setTheme } = useTheme();
    const setLocale = useLanguageStore((s) => s.setLocale);
    const { account, isLoading, error, load, retry, patch } = useAccountInfo();

    // The screen drives its own read, as the profile and the feed do.
    useEffect(() => {
        void load();
    }, [load]);

    const handleVerified = useCallback(
        () => patch({ isEmailVerified: true }),
        [patch],
    );

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader title={t("settings.title")} />

            <ScrollView
                contentContainerClassName="pb-10"
                keyboardShouldPersistTaps="handled"
            >
                <AccountInfoSection
                    account={account}
                    isLoading={isLoading}
                    error={error}
                    onRetry={retry}
                />

                {account && !account.isEmailVerified && (
                    // Keyed on the address, so a code sent to the previous one
                    // is not offered as though it were for the new one.
                    <VerifyEmailSection
                        key={account.email}
                        onVerified={handleVerified}
                    />
                )}

                <SettingsSection
                    title={t("settings.language")}
                    subtitle={t("settings.languageSubtitle")}
                >
                    <View className="flex-row gap-2">
                        {LOCALES.map((option) => (
                            <Button
                                key={option.value}
                                label={t(option.label)}
                                size="sm"
                                variant={
                                    locale === option.value
                                        ? "primary"
                                        : "outline"
                                }
                                onPress={() => setLocale(option.value)}
                            />
                        ))}
                    </View>
                </SettingsSection>

                <SettingsSection
                    title={t("settings.theme")}
                    subtitle={t("settings.themeSubtitle")}
                >
                    <View className="flex-row gap-2">
                        {THEMES.map((option) => (
                            <Button
                                key={option.value}
                                label={t(option.label)}
                                size="sm"
                                variant={
                                    theme === option.value
                                        ? "primary"
                                        : "outline"
                                }
                                onPress={() => setTheme(option.value)}
                            />
                        ))}
                    </View>
                </SettingsSection>

                <BlockedAccountsSection />

                <ChangeUsernameSection
                    onChanged={(username) => patch({ username })}
                />
                <ChangeEmailSection
                    onChanged={(email) =>
                        patch({ email, isEmailVerified: false })
                    }
                />
                <ChangePasswordSection />

                <DangerZoneSection
                    onSignOut={onSignOut}
                    onAccountDeleted={onAccountDeleted}
                />
            </ScrollView>
        </Screen>
    );
}
