import { Linking, View } from "react-native";

import { Button } from "@shared/ui/Button";
import { RefreshIcon } from "@shared/ui/icons/lucide";
import { Screen } from "@shared/ui/Screen";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface UpdateRequiredScreenProps {
    /** From the API. Empty when no store URL is configured. */
    storeUrl: string;
}

/**
 * The end of the road for a build the API no longer supports.
 *
 * Rendered *instead of* the navigator rather than pushed over it, which is the
 * one place in this app that argument wins. Sign-in redirects because a
 * session comes and goes and rebuilding the navigator each time would take the
 * back stack with it; this is terminal — there is nothing behind it to keep,
 * nothing to route to, and no gesture that should reach the app underneath.
 *
 * `Linking.openURL` rather than the in-app browser: a Play Store address
 * belongs in the Play app, and opening it in a web view is how somebody ends
 * up looking at a store page they cannot install from.
 *
 * **No button when `storeUrl` is empty**, which is the API's state today. A
 * button that opens nothing is worse than a screen that only explains itself,
 * because the second thing somebody does with it is press it again.
 */
export function UpdateRequiredScreen({ storeUrl }: UpdateRequiredScreenProps) {
    const { t } = useI18n();

    return (
        <Screen>
            <View className="flex-1 items-center justify-center gap-4 px-8">
                <View className="h-16 w-16 items-center justify-center rounded-full border border-ink/10 bg-ink/5">
                    <RefreshIcon size={28} className="text-ink/60" />
                </View>

                <Text size="title" className="text-center">
                    {t("update.title")}
                </Text>

                <Text tone="muted" className="text-center">
                    {t("update.body")}
                </Text>

                {storeUrl.length > 0 && (
                    <Button
                        label={t("update.action")}
                        className="mt-2"
                        onPress={() =>
                            // Caught rather than left to `void`: the address
                            // comes from a server-side setting, and one that
                            // no installed app can open rejects — which is an
                            // unhandled rejection on the one screen somebody
                            // is stuck on.
                            void Linking.openURL(storeUrl).catch(() => {})
                        }
                    />
                )}
            </View>
        </Screen>
    );
}
