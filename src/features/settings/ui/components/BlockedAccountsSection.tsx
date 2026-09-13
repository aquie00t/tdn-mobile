import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { View } from "react-native";

import { BlockedAccountRow } from "./BlockedAccountRow";
import { Button } from "@shared/ui/Button";
import { SettingsSection } from "./SettingsSection";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useBlockAction } from "@shared/hooks/useBlockAction";
import { useBlockedList } from "../hooks/useBlockedList";
import { useI18n } from "@shared/hooks/useI18n";

/**
 * Blocked accounts, inside Settings.
 *
 * This list is the only route back to a block. The account is invisible in
 * the feed, in search, on its own timeline and in the inbox, so an unblock
 * button anywhere else would have nothing to sit on.
 *
 * An unblock that worked takes its row away, which is the confirmation; one
 * that failed leaves the row and its button as they were.
 */
export function BlockedAccountsSection() {
    const { t } = useI18n();
    const {
        users,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        load,
        loadMore,
        retry,
        remove,
    } = useBlockedList();
    const { unblock, pendingId } = useBlockAction();

    // On every focus rather than once: see `useBlockedList`.
    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    const handleUnblock = async (userId: string) => {
        if (await unblock(userId)) remove(userId);
    };

    return (
        <SettingsSection
            title={t("block.blockedAccounts")}
            subtitle={t("block.blockedAccountsSubtitle")}
        >
            {isLoading ? (
                <View className="flex-row items-center gap-2">
                    <Spinner size="small" />
                    <Text size="small" tone="subtle">
                        {t("common.loading")}
                    </Text>
                </View>
            ) : (
                <View className="gap-3">
                    {/*
                     * An error and a list are not exclusive: a later page can
                     * fail with rows already here, and they stay. The reader
                     * is told only that it did not load, as `ErrorState`
                     * tells them; the reason went to `reportError`.
                     */}
                    {error && (
                        <View className="flex-row items-center justify-between gap-4">
                            <Text size="small" tone="subtle" className="flex-1">
                                {t("common.loadFailed")}
                            </Text>
                            <Button
                                label={t("common.tryAgain")}
                                variant="outline"
                                size="sm"
                                onPress={retry}
                            />
                        </View>
                    )}

                    {!error && users.length === 0 && (
                        <Text size="small" tone="subtle">
                            {t("block.empty")}
                        </Text>
                    )}

                    {users.map((user) => (
                        <BlockedAccountRow
                            key={user.userId}
                            user={user}
                            isPending={pendingId === user.userId}
                            isDisabled={pendingId !== null}
                            onUnblock={(userId) => void handleUnblock(userId)}
                        />
                    ))}

                    {hasMore && (
                        <Button
                            label={
                                isLoadingMore
                                    ? t("common.loadingMore")
                                    : t("common.loadMore")
                            }
                            variant="outline"
                            size="sm"
                            className="self-start"
                            loading={isLoadingMore}
                            onPress={() => void loadMore()}
                        />
                    )}
                </View>
            )}
        </SettingsSection>
    );
}
