import { View } from "react-native";

import type { AccountInfo } from "../../data/settings.types";
import { Button } from "@shared/ui/Button";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { readerFacingMessage } from "@shared/utils/report-error";
import { useI18n } from "@shared/hooks/useI18n";

export interface AccountInfoSectionProps {
    account: AccountInfo | null;
    isLoading: boolean;
    error: string | null;
    onRetry: () => void;
}

/**
 * Who the account is, as the server has it.
 *
 * Loading and failure are shown inside the section rather than over the page:
 * everything below it — the theme, the language, signing out — works without
 * this read, and a failed request should not take them away.
 */
export function AccountInfoSection({
    account,
    isLoading,
    error,
    onRetry,
}: AccountInfoSectionProps) {
    const { t, locale } = useI18n();

    return (
        <SettingsSection title={t("settings.accountInfo")}>
            {isLoading && (
                <View className="flex-row items-center gap-2">
                    <Spinner size="small" />
                    <Text size="small" tone="subtle">
                        {t("settings.accountInfoLoading")}
                    </Text>
                </View>
            )}

            {error && !isLoading && (
                <View className="items-start gap-2">
                    <Text size="small" tone="subtle">
                        {readerFacingMessage(error)}
                    </Text>
                    <Button
                        label={t("postList.tryAgain")}
                        variant="outline"
                        size="sm"
                        onPress={onRetry}
                    />
                </View>
            )}

            {account && (
                <View className="gap-3">
                    <InfoRow
                        label={t("settings.username")}
                        value={`@${account.username}`}
                    />
                    <InfoRow
                        label={t("settings.email")}
                        value={account.email}
                    />
                    <InfoRow
                        label={t("settings.emailVerified")}
                        value={
                            account.isEmailVerified
                                ? t("settings.yes")
                                : t("settings.no")
                        }
                    />
                    <InfoRow
                        label={t("settings.signInMethods")}
                        value={account.providers.join(", ") || "—"}
                    />
                    <InfoRow
                        label={t("settings.memberSince")}
                        value={new Intl.DateTimeFormat(locale, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        }).format(new Date(account.createdAt))}
                    />
                </View>
            )}
        </SettingsSection>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row items-center justify-between gap-4">
            <Text size="small" tone="subtle" className="shrink-0">
                {label}
            </Text>
            <Text size="small" numberOfLines={1} className="flex-1 text-right">
                {value}
            </Text>
        </View>
    );
}
