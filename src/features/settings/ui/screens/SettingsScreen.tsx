import { ScrollView, View } from "react-native";
import type { ReactNode } from "react";

import { Button } from "@shared/ui/Button";
import type { Locale } from "@shared/store/language.store";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Text } from "@shared/ui/Text";
import type { Theme } from "@shared/store/theme.store";
import type { TranslationKey } from "@shared/i18n/translations";
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

/**
 * The settings the app can actually answer today.
 *
 * The web's page carries nine sections; six of them — account info, changing a
 * username, an email or a password, verifying an address and blocked accounts
 * — need endpoints and screens this client has not built yet, and deleting an
 * account needs a confirm the `Modal` primitive would have to provide. Those
 * are PR 21's, and PR 22's for blocking.
 *
 * What is here is what was living on the profile tab because it had nowhere
 * else to be: the theme, the language, and the way out. A profile is a page
 * about a person; a switch for how the app looks is not part of that, and a
 * full-width sign-out button under somebody's posts reads as an instruction.
 */
export interface SettingsScreenProps {
    /**
     * Wired by the route. Signing out means telling the server, which means a
     * feature's data layer — and a feature may not reach into another, so the
     * screen is handed the action rather than finding it.
     */
    onSignOut: () => void;
}

export function SettingsScreen({ onSignOut }: SettingsScreenProps) {
    const { t, locale } = useI18n();
    const { theme, setTheme } = useTheme();
    const setLocale = useLanguageStore((s) => s.setLocale);

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader title={t("settings.title")} />

            <ScrollView contentContainerClassName="pb-10">
                <Section
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
                </Section>

                <Section
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
                </Section>

                <Section
                    title={t("settings.dangerZone")}
                    subtitle={t("settings.logOutSubtitle")}
                >
                    <Button
                        label={t("settings.logOut")}
                        variant="outline"
                        size="full"
                        onPress={onSignOut}
                    />
                </Section>
            </ScrollView>
        </Screen>
    );
}

function Section({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    return (
        <View className="gap-3 border-b border-ink/10 px-4 py-6">
            <View className="gap-1">
                <Text className="font-semibold">{title}</Text>
                <Text size="small" tone="subtle">
                    {subtitle}
                </Text>
            </View>
            {children}
        </View>
    );
}
