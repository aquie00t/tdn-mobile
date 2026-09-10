import { View } from "react-native";

import { Avatar } from "../../shared/ui/Avatar";
import { Button } from "../../shared/ui/Button";
import { ProfileIcon } from "../../shared/ui/icons/lucide";
import { Screen } from "../../shared/ui/Screen";
import { Text } from "../../shared/ui/Text";
import type { Theme } from "../../shared/store/theme.store";
import type { TranslationKey } from "../../shared/i18n/translations";
import { useAuthActions } from "../../features/auth/ui/hooks/useAuthActions";
import { useI18n } from "../../shared/hooks/useI18n";
import { useSessionStore } from "../../core/session/session.store";
import { useTheme } from "../../shared/hooks/useTheme";

const THEMES: { value: Theme; label: TranslationKey }[] = [
    { value: "dark", label: "settings.themeDark" },
    { value: "light", label: "settings.themeLight" },
    { value: "system", label: "settings.themeSystem" },
];

/**
 * The one tab that is not a placeholder, and not because profiles are ready —
 * PR 13 builds the real screen. It carries the two controls that had nowhere
 * else to live once the design-system demo at `app/index.tsx` was replaced by
 * the tabs: the theme, and **signing out**.
 *
 * Sign-out especially. It was the demo screen's only home, and settings do not
 * land until PR 21; an app somebody cannot leave is worse than an app with a
 * plain profile tab. It is written directly in the route rather than in a
 * `features/profile/` screen because it reaches `useAuthActions`, and a
 * feature may not import another feature — a route may.
 */
export default function ProfileTab() {
    const { t } = useI18n();
    const { theme, setTheme } = useTheme();
    const user = useSessionStore((s) => s.user);
    const { signOut } = useAuthActions();

    return (
        <Screen scroll edges={{ top: true, bottom: false }} className="px-6">
            <View className="items-center gap-3 py-10">
                {user?.avatarUrl ? (
                    <Avatar uri={user.avatarUrl} size={72} />
                ) : (
                    <View className="h-[72px] w-[72px] items-center justify-center rounded-full border border-ink/10 bg-ink/5">
                        <ProfileIcon size={32} className="text-ink/40" />
                    </View>
                )}

                <View className="items-center gap-1">
                    <Text size="title">{user?.fullName ?? user?.username}</Text>
                    <Text tone="subtle">@{user?.username}</Text>
                </View>

                {user && !user.isEmailVerified && (
                    <Text size="small" tone="danger">
                        {t("auth.verifyEmail")}
                    </Text>
                )}
            </View>

            <View className="gap-3 border-t border-ink/10 py-6">
                <Text size="caption" tone="subtle" className="uppercase">
                    {t("settings.theme")}
                </Text>
                <View className="flex-row gap-2">
                    {THEMES.map((option) => (
                        <Button
                            key={option.value}
                            label={t(option.label)}
                            size="sm"
                            variant={
                                theme === option.value ? "primary" : "outline"
                            }
                            onPress={() => setTheme(option.value)}
                        />
                    ))}
                </View>
            </View>

            <View className="border-t border-ink/10 py-6">
                <Button
                    label={t("settings.logOut")}
                    variant="outline"
                    size="full"
                    onPress={() => void signOut()}
                />
            </View>
        </Screen>
    );
}
