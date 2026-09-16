import { View } from "react-native";
import { useState } from "react";

import { Avatar } from "@shared/ui/Avatar";
import { Button } from "@shared/ui/Button";
import type { Conversation } from "../../data/message.types";
import { Modal } from "@shared/ui/Modal";
import { ProfileIcon } from "@shared/ui/icons/lucide";
import { Text } from "@shared/ui/Text";
import { useConversationActions } from "../hooks/useConversationActions";
import { useI18n } from "@shared/hooks/useI18n";

export interface RequestRowProps {
    conversation: Conversation;
}

/**
 * One row of the request tab: a decision to make, or one somebody else has.
 *
 * **The listing holds both directions.** `?status=PENDING` filters on
 * participation and status, never on who opened the thread, so it answers with
 * the requests sent *to* the reader and the ones they sent that have not been
 * accepted. Only the first is a decision, and `isRequest` — resolved per
 * reader by the server — is what says which is which. Offering accept and
 * decline on an outgoing request would be two buttons whose every press is a
 * `403 MessageNotSendableError`, shown to somebody under their own message.
 *
 * That is the rule the types already state and the reason nothing here reads
 * `status`: the initiator of a pending conversation may already write to it
 * and has nothing to decide.
 *
 * **The web puts accept and decline at the top of the thread**; here they are
 * on the row. Partly because the thread is the next pull request and a
 * decision with no screen to make it on would be no decision at all — but also
 * because it is the better shape on a phone: answering three requests is three
 * taps in one list rather than three round trips through a conversation nobody
 * has agreed to have yet.
 *
 * No unread pip, and that is deliberate rather than an omission. A request is
 * not a message waiting to be read; it is a decision waiting to be made, and
 * the two counters mean different things — which is also why the API refuses
 * to count requests into the unread badge.
 *
 * Declining is confirmed because it is **terminal**: a later attempt to open
 * the same pair returns the declined thread unchanged, so there is no undo to
 * offer afterwards.
 */
export function RequestRow({ conversation }: RequestRowProps) {
    const { t } = useI18n();
    const { accept, decline, busy, isBusy, error } = useConversationActions();
    const [isConfirming, setIsConfirming] = useState(false);

    const { participant, lastMessagePreview, isRequest } = conversation;
    const name = participant.fullName || participant.username;

    const handleDecline = async () => {
        await decline(conversation.id);
        // Closed on the way out rather than on the way in, so the spinner has
        // somewhere to live. It closes on a failure too — the server's answer
        // is rendered on the row, beside the buttons that produced it.
        setIsConfirming(false);
    };

    return (
        <View className="gap-3 border-b border-ink/10 px-4 py-3">
            <View className="flex-row items-center gap-3">
                {participant.avatarUrl ? (
                    <Avatar uri={participant.avatarUrl} size={48} />
                ) : (
                    <View className="h-12 w-12 items-center justify-center rounded-full border border-ink/10 bg-surface-2">
                        <ProfileIcon size={22} className="text-ink/40" />
                    </View>
                )}

                <View className="min-w-0 flex-1 gap-0.5">
                    <Text numberOfLines={1} className="font-semibold">
                        {name}
                    </Text>
                    <Text size="caption" tone="subtle" numberOfLines={1}>
                        @{participant.username}
                    </Text>
                    <Text size="small" tone="muted" numberOfLines={2}>
                        {lastMessagePreview ?? t("messages.startHint")}
                    </Text>
                </View>
            </View>

            {isRequest ? (
                <View className="flex-row gap-2 pl-[60px]">
                    <Button
                        label={t("messages.accept")}
                        size="sm"
                        disabled={isBusy}
                        loading={busy === "accept"}
                        onPress={() => void accept(conversation.id)}
                    />
                    <Button
                        label={t("messages.decline")}
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onPress={() => setIsConfirming(true)}
                    />
                </View>
            ) : (
                /*
                 * The reader's own request, still unanswered. There is nothing
                 * here to press, and saying so is more use than a pair of
                 * buttons whose every press would be refused.
                 */
                <Text size="caption" tone="subtle" className="pl-[60px]">
                    {t("messages.awaitingAccept")}
                </Text>
            )}

            {/*
             * Only an answer the reader has to act on. These writes are capped
             * at five a minute, which somebody clearing a few requests in one
             * sitting can reach — and a 429 that said nothing would look like
             * two buttons that had quietly stopped working. Our own failures
             * leave this empty and go to `reportError`.
             */}
            {error && (
                <Text size="caption" tone="danger" className="pl-[60px]">
                    {error}
                </Text>
            )}

            <Modal
                visible={isConfirming}
                onClose={() => setIsConfirming(false)}
                // A decline whose outcome the person can no longer see is worse
                // than a dialog that waits: they would not know whether the
                // thread they can never reopen is in fact closed.
                dismissible={!isBusy}
            >
                <View className="gap-4">
                    <View className="gap-2">
                        <Text size="title">{t("messages.declineConfirm")}</Text>
                        <Text size="small" tone="muted">
                            {t("messages.declineConfirmBody")}
                        </Text>
                    </View>

                    <View className="gap-2">
                        <Button
                            label={t("messages.decline")}
                            variant="danger"
                            size="full"
                            disabled={isBusy}
                            loading={busy === "decline"}
                            onPress={() => void handleDecline()}
                        />
                        <Button
                            label={t("messages.cancel")}
                            variant="ghost"
                            size="full"
                            disabled={isBusy}
                            onPress={() => setIsConfirming(false)}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
