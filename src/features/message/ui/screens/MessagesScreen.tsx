import { FlatList, Pressable, View } from "react-native";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useFocusEffect } from "expo-router";

import { Button } from "@shared/ui/Button";
import type { Conversation } from "../../data/message.types";
import { ConversationRow } from "../components/ConversationRow";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import { formatBadgeCount } from "@shared/utils/badge-count";
import { MessagesIcon } from "@shared/ui/icons/lucide";
import { messageApi } from "../../data/message.api";
import { RequestRow } from "../components/RequestRow";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { cn } from "@shared/ui/cn";
import { useConversations } from "../hooks/useConversations";
import { useI18n } from "@shared/hooks/useI18n";
import { useMessageStore } from "../store/message.store";

type InboxTab = "inbox" | "requests";

const conversationKey = (conversation: Conversation) => conversation.id;

/**
 * The inbox: accepted conversations, and the requests waiting on a decision.
 *
 * **Two listings rather than one filtered list.** They are different endpoints
 * answering different questions — `?status=ACCEPTED` and `?status=PENDING` —
 * each with a cursor of its own, and the API will not hand over both at once.
 *
 * Both hooks mount together, so the requests tab is read even when nobody
 * opens it. That is one extra request per visit, against a read budget of
 * sixty a minute, and it buys the count on the tab: there is no endpoint for
 * "how many requests", by design — `/conversations/unread-count` covers
 * `ACCEPTED` only so a stranger cannot raise somebody's badge — so the number
 * can only come from the listing itself.
 *
 * Both kinds of row open the thread. A request also carries its decision, so
 * a handful of them can be answered from the list without going through a
 * conversation nobody has agreed to have yet.
 */
export function MessagesScreen() {
    const { t } = useI18n();
    const [tab, setTab] = useState<InboxTab>("inbox");

    const conversations = useMessageStore((s) => s.conversations);
    const requests = useMessageStore((s) => s.requests);
    const requestCount = useMessageStore((s) => s.requestCount);
    const setUnreadCount = useMessageStore((s) => s.setUnreadCount);

    const inbox = useConversations("ACCEPTED");
    const pending = useConversations("PENDING");

    const isInbox = tab === "inbox";

    /*
     * Read again on every focus, quietly.
     *
     * A tab keeps its state while it is not the one on screen, and the socket
     * is closed for the whole time the app is in the background — so whatever
     * arrived in that window reached neither. Nothing here raises a spinner
     * over rows that are already up, and `reloadFromTop` declines outright on
     * the two occasions where a first page would do harm rather than good:
     * before the mount load has landed, which is this screen's own first
     * focus, and once the reader has paged past it.
     */
    const { reloadFromTop: reloadInbox, loadMore: loadMoreInbox } = inbox;
    const { reloadFromTop: reloadPending, loadMore: loadMorePending } = pending;

    useFocusEffect(
        useCallback(() => {
            void reloadInbox();
            void reloadPending();

            /*
             * The badge is read here as well, and it is the one value on this
             * screen that something else is also writing: the socket raises it
             * while this request is in the air. So the answer is only taken if
             * nothing moved the count in the meantime — otherwise a reply that
             * left the server before the message arrived would put the badge
             * back down, and nothing until the next focus would correct it.
             */
            let cancelled = false;
            const before = useMessageStore.getState().unreadCount;

            messageApi
                .getUnreadCount()
                .then((count) => {
                    if (cancelled) return;
                    if (useMessageStore.getState().unreadCount !== before)
                        return;
                    setUnreadCount(count);
                })
                .catch(() => {
                    // The badge keeps its last known value. Nothing here is
                    // worth saying to the reader.
                });

            return () => {
                cancelled = true;
            };
        }, [reloadInbox, reloadPending, setUnreadCount]),
    );

    const renderConversation = useCallback(
        ({ item }: { item: Conversation }) => (
            <ConversationRow conversation={item} />
        ),
        [],
    );

    const renderRequest = useCallback(
        ({ item }: { item: Conversation }) => (
            <RequestRow conversation={item} />
        ),
        [],
    );

    /*
     * Memoised because `FlatList` treats a changed `onEndReached` as a reason
     * to re-evaluate whether the end has been reached, which is how a fresh
     * closure on every render turns into repeated calls.
     *
     * On `loadMore` itself, not on the object carrying it: the hook returns a
     * fresh literal every render, so depending on that would be a memo that
     * changes identity every render — the very thing being avoided.
     */
    const reachInboxEnd = useCallback(() => {
        void loadMoreInbox();
    }, [loadMoreInbox]);

    const reachPendingEnd = useCallback(() => {
        void loadMorePending();
    }, [loadMorePending]);

    /** A list's own footer: the next page, or the end of the listing. */
    const footerFor = (
        list: ReturnType<typeof useConversations>,
        rows: number,
    ) => {
        if (list.isLoadingMore) {
            return (
                <View className="py-6">
                    <Spinner />
                </View>
            );
        }

        if (list.hasMore) {
            return (
                <View className="items-center py-4">
                    <Button
                        label={t("messages.loadMore")}
                        size="sm"
                        variant="outline"
                        onPress={() => void list.loadMore()}
                    />
                </View>
            );
        }

        return rows > 0 ? (
            <View className="items-center py-6">
                <Text size="caption" tone="subtle">
                    {t("postList.noMore")}
                </Text>
            </View>
        ) : null;
    };

    /*
     * One pane's own loading and error states, so a failure on one tab never
     * blanks the other: the two listings are separate requests and either can
     * fail on its own.
     */
    const paneFor = (
        list: ReturnType<typeof useConversations>,
        rows: Conversation[],
        body: ReactNode,
    ) => {
        if (list.isLoading) return <Spinner center />;

        if (list.error && rows.length === 0) {
            return (
                <ErrorState
                    message={list.error}
                    onRetry={() => void list.refresh()}
                    retryLabel={t("messages.retry")}
                />
            );
        }

        return body;
    };

    return (
        <Screen edges={{ top: true, bottom: false }}>
            <ScreenHeader title={t("messages.title")} showBack={false} />

            <View className="flex-row border-b border-ink/10">
                <TabButton
                    label={t("messages.tabInbox")}
                    isActive={isInbox}
                    onPress={() => setTab("inbox")}
                />
                <TabButton
                    label={t("messages.tabRequests")}
                    badge={formatBadgeCount(requestCount)}
                    isActive={!isInbox}
                    onPress={() => setTab("requests")}
                />
            </View>

            {/*
             * Both lists stay mounted and one is hidden, rather than a ternary
             * that unmounts the other: a `FlatList` that is unmounted loses
             * its scroll position, and because the rows live in the store
             * nothing would reload to explain the jump back to the top.
             *
             * The hidden one is handed no `onEndReached`. Laid out at no
             * height, its content is shorter than its viewport by definition,
             * so it would ask for the next page immediately.
             */}
            <ListPane isVisible={isInbox}>
                {paneFor(
                    inbox,
                    conversations,
                    <FlatList
                        data={conversations}
                        keyExtractor={conversationKey}
                        renderItem={renderConversation}
                        onEndReached={isInbox ? reachInboxEnd : undefined}
                        onEndReachedThreshold={0.5}
                        // The way back for a list that has paged past its
                        // first page, which the quiet reload leaves alone.
                        refreshing={inbox.isRefreshing}
                        onRefresh={() => void inbox.pullToRefresh()}
                        windowSize={7}
                        maxToRenderPerBatch={5}
                        ListEmptyComponent={
                            <EmptyState
                                title={t("messages.empty")}
                                description={t("messages.emptyHint")}
                                icon={
                                    <MessagesIcon
                                        size={28}
                                        className="text-ink/40"
                                    />
                                }
                            />
                        }
                        ListFooterComponent={footerFor(
                            inbox,
                            conversations.length,
                        )}
                    />,
                )}
            </ListPane>

            <ListPane isVisible={!isInbox}>
                {paneFor(
                    pending,
                    requests,
                    <FlatList
                        data={requests}
                        keyExtractor={conversationKey}
                        renderItem={renderRequest}
                        onEndReached={isInbox ? undefined : reachPendingEnd}
                        onEndReachedThreshold={0.5}
                        refreshing={pending.isRefreshing}
                        onRefresh={() => void pending.pullToRefresh()}
                        windowSize={7}
                        maxToRenderPerBatch={5}
                        ListEmptyComponent={
                            <EmptyState
                                title={t("messages.emptyRequests")}
                                description={t("messages.emptyRequestsHint")}
                            />
                        }
                        ListFooterComponent={footerFor(
                            pending,
                            requests.length,
                        )}
                    />,
                )}
            </ListPane>
        </Screen>
    );
}

/** Holds a list's place in the tree while the other tab is on screen. */
function ListPane({
    isVisible,
    children,
}: {
    isVisible: boolean;
    children: ReactNode;
}) {
    return (
        <View className={cn("flex-1", !isVisible && "hidden")}>{children}</View>
    );
}

interface TabButtonProps {
    label: string;
    /** Already formatted — `null` when there is nothing waiting. */
    badge?: string | null;
    isActive: boolean;
    onPress: () => void;
}

/**
 * One of the two strip buttons, as the saved list draws them: the underline is
 * inset from both edges, or a rule the full width of the button reads as a
 * border between the two rather than a mark on one.
 */
function TabButton({ label, badge, isActive, onPress }: TabButtonProps) {
    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={onPress}
            className="flex-1 items-center py-3 active:bg-ink/5"
        >
            <View className="flex-row items-center gap-1.5">
                <Text
                    size="small"
                    tone={isActive ? "default" : "subtle"}
                    className="font-medium"
                >
                    {label}
                </Text>
                {badge && (
                    <View className="min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5">
                        <Text
                            tone="onFill"
                            className="text-[10px] font-bold leading-none"
                        >
                            {badge}
                        </Text>
                    </View>
                )}
            </View>
            <View
                className={cn(
                    "mt-2 h-0.5 w-12 rounded-full",
                    isActive ? "bg-ink" : "bg-transparent",
                )}
            />
        </Pressable>
    );
}
