import { FlatList, Pressable, View } from "react-native";
import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import type { Notification } from "../../data/notification.types";
import { NotificationCard } from "../components/NotificationCard";
import { notificationApi } from "../../data/notification.api";
import { PushPromptCard } from "../components/PushPromptCard";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { useNotifications } from "../hooks/useNotifications";
import { useNotificationStore } from "../store/notification.store";
import { usePushPermissionPrompt } from "../hooks/usePushPermissionPrompt";

/**
 * A composite key, because the API sends no id.
 *
 * Two notifications can share an issuer and a type — two likes on two posts —
 * so the reference has to be in it as well. `createdAt` alone is not enough
 * either: a burst arriving in the same second would collide.
 */
const keyOf = (notification: Notification) =>
    `${notification.createdAt}:${notification.issuerId}:${notification.type}:${notification.referenceId ?? ""}`;

export function NotificationsScreen() {
    const { t } = useI18n();

    const notifications = useNotificationStore((s) => s.notifications);
    const unreadCount = useNotificationStore((s) => s.unreadCount);
    const markAllRead = useNotificationStore((s) => s.markAllRead);
    const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

    const {
        fetchNotifications,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
    } = useNotifications();

    const pushPrompt = usePushPermissionPrompt();

    /*
     * Read on every focus, not once on mount.
     *
     * A tab keeps its state while it is not the one on screen — more so since
     * inactive tabs were detached rather than unmounted — so a mount-time read
     * happens exactly once per session. The socket meanwhile raises the badge
     * from a payload too thin to become a row, which is the whole failure:
     * a number appears on the tab, the reader opens it, and the thing that
     * caused it is not in the list.
     */
    useFocusEffect(
        useCallback(() => {
            void fetchNotifications();
        }, [fetchNotifications]),
    );

    const renderItem = useCallback(
        ({ item }: { item: Notification }) => (
            <NotificationCard notification={item} />
        ),
        [],
    );

    /**
     * Applied before the request and re-read from the server if it fails.
     *
     *
     * Rolling back to the previous number would be the obvious move and the
     * wrong one: the socket may have incremented it while the request was in
     * flight, so the number this screen remembers is already out of date. The
     * endpoint that owns the count is the only thing that can say what it is.
     */
    const handleMarkAllRead = async () => {
        markAllRead();

        try {
            await notificationApi.markAllRead();
        } catch {
            notificationApi
                .getUnreadCount()
                .then(setUnreadCount)
                .catch(() => {
                    // Nothing better to do than leave it at zero; the next
                    // boot reads it again.
                });
        }
    };

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader
                title={t("notif.title")}
                showBack={false}
                right={
                    unreadCount > 0 ? (
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => void handleMarkAllRead()}
                            hitSlop={8}
                            className="px-2 py-1"
                        >
                            <Text size="caption" tone="accent">
                                {t("notif.markAllRead")}
                            </Text>
                        </Pressable>
                    ) : undefined
                }
            />

            {isLoading ? (
                <Spinner center />
            ) : error ? (
                <ErrorState
                    message={error}
                    onRetry={() => void fetchNotifications()}
                    retryLabel={t("notif.tryAgain")}
                />
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={keyOf}
                    renderItem={renderItem}
                    /*
                     * Above notifications that already exist, and only then.
                     *
                     * The card is the app's one chance to ask for the
                     * notification permission — Android shows its dialog once
                     * per install — so it is spent where the question explains
                     * itself: on top of the things it is offering to put on a
                     * lock screen. On an empty list there is nothing to point
                     * at, and the safe answer to a request about nothing is no.
                     */
                    ListHeaderComponent={
                        pushPrompt.isVisible && notifications.length > 0 ? (
                            <PushPromptCard
                                isAsking={pushPrompt.isAsking}
                                onEnable={() => void pushPrompt.enable()}
                                onDismiss={pushPrompt.dismiss}
                            />
                        ) : null
                    }
                    onEndReached={() => void loadMore()}
                    onEndReachedThreshold={0.5}
                    windowSize={7}
                    ListEmptyComponent={
                        <EmptyState
                            title={t("notif.emptyTitle")}
                            description={t("notif.emptyBody")}
                        />
                    }
                    ListFooterComponent={
                        isLoadingMore ? (
                            <View className="py-6">
                                <Spinner />
                            </View>
                        ) : !hasMore && notifications.length > 0 ? (
                            <View className="items-center py-6">
                                <Text size="caption" tone="subtle">
                                    {t("postList.noMore")}
                                </Text>
                            </View>
                        ) : null
                    }
                />
            )}
        </Screen>
    );
}
