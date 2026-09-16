import { FlatList, KeyboardAvoidingView, View } from "react-native";
import { useCallback } from "react";
import { useIsFocused } from "expo-router";

import { Button } from "@shared/ui/Button";
import { EmptyState } from "@shared/ui/EmptyState";
import { ErrorState } from "@shared/ui/ErrorState";
import type { Message } from "../../data/message.types";
import { MessageBubble } from "../components/MessageBubble";
import { MessageComposer } from "../components/MessageComposer";
import { Screen } from "@shared/ui/Screen";
import { ScreenHeader } from "@shared/layout/ScreenHeader";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useConversation } from "../hooks/useConversation";
import { useConversationActions } from "../hooks/useConversationActions";
import { useDeleteMessage } from "../hooks/useDeleteMessage";
import { useI18n } from "@shared/hooks/useI18n";
import { useMessageStore } from "../store/message.store";

export interface ThreadScreenProps {
    conversationId: string;
}

const messageKey = (message: Message) => message.id;

/**
 * One conversation.
 *
 * **Inverted**, which is the whole reason the list works at all here: the API
 * returns messages newest first and paging walks backwards through history, so
 * an inverted `FlatList` renders that array the right way up, opens at the
 * newest message without a scroll-to-end, and asks for older pages by reaching
 * what is visually the top.
 *
 * Everything about what may be done here comes from `isRequest` and `canSend`,
 * never from `status`. The three states that produces read differently on
 * purpose: a request *the reader received* gets the decision at the top and no
 * composer, one they *sent* gets a line saying it is waiting, and a declined
 * thread gets its history and a sentence saying it is closed.
 */
export function ThreadScreen({ conversationId }: ThreadScreenProps) {
    const { t } = useI18n();
    // Focus, not mount: a thread left behind on the stack is not one somebody
    // is reading, and a message arriving in it has been read by nobody.
    const isFocused = useIsFocused();

    const conversation = useMessageStore((s) => s.activeConversation);
    const messages = useMessageStore((s) => s.messages);

    const {
        isLoading,
        isLoadingOlder,
        error,
        notFound,
        hasOlder,
        loadOlder,
        retry,
    } = useConversation(conversationId, isFocused);

    const { accept, decline, busy, isBusy } = useConversationActions();
    const { remove, error: deleteError } = useDeleteMessage();

    /**
     * The newest message the reader sent.
     *
     * Read state is per conversation — one watermark each way, not a receipt
     * per message — so exactly one bubble carries "Seen" or "Sent". The array
     * is newest first, which makes this the first match rather than the last.
     */
    const latestMineId = messages.find((m) => m.isMine && !m.isDeleted)?.id;

    const renderMessage = useCallback(
        ({ item }: { item: Message }) => (
            <MessageBubble
                message={item}
                otherLastReadAt={conversation?.otherLastReadAt ?? null}
                isLatestMine={item.id === latestMineId}
                onDelete={(id) => void remove(id)}
            />
        ),
        [conversation?.otherLastReadAt, latestMineId, remove],
    );

    const reachOlder = useCallback(() => {
        void loadOlder();
    }, [loadOlder]);

    const title =
        conversation?.participant.fullName ||
        conversation?.participant.username ||
        t("messages.title");

    if (notFound) {
        return (
            <Screen edges={{ top: true, bottom: true }}>
                <ScreenHeader title={t("messages.title")} />
                <EmptyState
                    title={t("messages.notFound")}
                    description={t("messages.notFoundHint")}
                />
            </Screen>
        );
    }

    return (
        <Screen edges={{ top: true, bottom: true }}>
            <ScreenHeader title={title} />

            <KeyboardAvoidingView className="flex-1" behavior="padding">
                {/*
                 * A request the reader received: the decision comes before the
                 * messages, because until it is made there is nothing they can
                 * do in here. The same pair of controls is on the inbox row —
                 * whichever way somebody arrives, the answer is one tap away.
                 */}
                {conversation?.isRequest && (
                    <View className="gap-3 border-b border-ink/10 bg-surface-1 px-4 py-3">
                        <Text size="small" tone="muted">
                            {t("messages.requestNotice", {
                                name:
                                    conversation.participant.fullName ||
                                    conversation.participant.username,
                            })}
                        </Text>
                        <View className="flex-row gap-2">
                            <Button
                                label={t("messages.accept")}
                                size="sm"
                                disabled={isBusy}
                                loading={busy === "accept"}
                                onPress={() => void accept(conversationId)}
                            />
                            <Button
                                label={t("messages.decline")}
                                variant="outline"
                                size="sm"
                                disabled={isBusy}
                                loading={busy === "decline"}
                                onPress={() => void decline(conversationId)}
                            />
                        </View>
                    </View>
                )}

                {isLoading ? (
                    <Spinner center />
                ) : error && messages.length === 0 ? (
                    <ErrorState
                        message={error}
                        onRetry={() => void retry()}
                        retryLabel={t("messages.retry")}
                    />
                ) : (
                    <FlatList
                        data={messages}
                        keyExtractor={messageKey}
                        renderItem={renderMessage}
                        /*
                         * Newest at the bottom without a scroll: the data runs
                         * newest first and the list is drawn upside down, so
                         * "the end" is the oldest message and reaching it is
                         * what asks for more history.
                         */
                        inverted
                        onEndReached={hasOlder ? reachOlder : undefined}
                        onEndReachedThreshold={0.5}
                        windowSize={7}
                        maxToRenderPerBatch={10}
                        keyboardShouldPersistTaps="handled"
                        contentContainerClassName="gap-2 px-4 py-3"
                        ListEmptyComponent={
                            <EmptyState
                                title={t("messages.startHint")}
                                description={
                                    conversation?.canSend
                                        ? undefined
                                        : t("messages.cannotSend")
                                }
                            />
                        }
                        /*
                         * The footer of an inverted list is drawn at the top,
                         * which is where the older pages arrive.
                         */
                        ListFooterComponent={
                            isLoadingOlder ? (
                                <View className="py-4">
                                    <Spinner />
                                </View>
                            ) : null
                        }
                    />
                )}

                {/*
                 * A withdrawal is optimistic, so a refusal puts the message
                 * back — and a bubble that reappeared with nothing said would
                 * read as a button that does not work. These writes share the
                 * five-a-minute budget with sending.
                 */}
                {deleteError && (
                    <View className="border-t border-ink/10 px-4 pt-2">
                        <Text size="caption" tone="danger">
                            {deleteError}
                        </Text>
                    </View>
                )}

                {conversation?.canSend ? (
                    <>
                        {/*
                         * The reader's own request, still unanswered. They may
                         * write — the API lets the initiator of a pending
                         * conversation keep writing — but nothing they send is
                         * delivered until it is accepted, and a thread that
                         * looked ordinary while nobody was reading it would be
                         * the wrong impression to leave.
                         */}
                        {conversation.status === "PENDING" && (
                            <View className="border-t border-ink/10 px-4 pt-2">
                                <Text size="caption" tone="subtle">
                                    {t("messages.awaitingAccept")}
                                </Text>
                            </View>
                        )}
                        <MessageComposer conversationId={conversationId} />
                    </>
                ) : conversation ? (
                    /*
                     * Three ways to be unable to write, and the server has
                     * already decided which: a request waiting on the other
                     * side, a request waiting on this one, and a thread that
                     * was declined — terminal, with no way to reopen it.
                     */
                    <View className="border-t border-ink/10 px-4 py-3">
                        <Text size="caption" tone="subtle">
                            {conversation.status === "DECLINED"
                                ? t("messages.declined")
                                : conversation.isRequest
                                  ? t("messages.requestNotice", {
                                        name:
                                            conversation.participant.fullName ||
                                            conversation.participant.username,
                                    })
                                  : t("messages.cannotSend")}
                        </Text>
                    </View>
                ) : null}
            </KeyboardAvoidingView>
        </Screen>
    );
}
