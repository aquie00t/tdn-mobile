import { Pressable, View } from "react-native";
import { memo, useState } from "react";

import { Button } from "@shared/ui/Button";
import type { Message } from "../../data/message.types";
import { Modal } from "@shared/ui/Modal";
import { RichText } from "@shared/ui/RichText";
import { Text } from "@shared/ui/Text";
import { isPendingMessage } from "../hooks/useSendMessage";
import { useI18n } from "@shared/hooks/useI18n";

export interface MessageBubbleProps {
    message: Message;
    /**
     * The other participant last opened the thread at this time.
     *
     * Read state is per conversation, so this is one watermark rather than a
     * receipt per message: a sent message counts as seen when it predates it.
     */
    otherLastReadAt: string | null;
    /**
     * Whether this is the newest message the reader sent.
     *
     * One watermark, not a receipt each — so repeating "Seen" under every
     * outgoing bubble would state the same fact six times down a screen, and
     * read as six separate events.
     */
    isLatestMine: boolean;
    onDelete: (id: string) => void;
}

/**
 * One message.
 *
 * **Withdrawn messages keep their place.** The row becomes a tombstone rather
 * than disappearing, because the other participant may have replied to it and
 * closing the gap would leave their reply answering nothing. That is the
 * API's design, not this screen's: the row survives the deletion server-side
 * for the same reason.
 *
 * Deleting is a **long press**, where the web reveals a control on hover. A
 * phone has no hover, and a visible button under every one of your own
 * messages spends a row of space on something used once a month.
 *
 * Media is not drawn here yet — attachments are their own pull request, along
 * with the three flags that describe them. Until then a message is its text.
 */
function MessageBubbleView({
    message,
    otherLastReadAt,
    isLatestMine,
    onDelete,
}: MessageBubbleProps) {
    const { t } = useI18n();
    const [isConfirming, setIsConfirming] = useState(false);

    const isMine = message.isMine;

    if (message.isDeleted) {
        return (
            <View className={isMine ? "items-end" : "items-start"}>
                <View className="max-w-[78%] rounded-2xl border border-dashed border-ink/20 px-4 py-2">
                    <Text size="small" tone="subtle" className="italic">
                        {t("messages.deleted")}
                    </Text>
                </View>
            </View>
        );
    }

    const isSeen =
        isMine &&
        !!otherLastReadAt &&
        new Date(message.createdAt) <= new Date(otherLastReadAt);

    // A message the server has not acknowledged has no id to withdraw, so it
    // is not offered the gesture.
    const canDelete = isMine && !isPendingMessage(message.id);

    return (
        <View className={isMine ? "items-end" : "items-start"}>
            <Pressable
                accessibilityRole="text"
                accessibilityLabel={message.content}
                accessibilityHint={canDelete ? t("messages.delete") : undefined}
                onLongPress={
                    canDelete ? () => setIsConfirming(true) : undefined
                }
                delayLongPress={350}
                className={
                    isMine
                        ? "max-w-[78%] rounded-2xl bg-accent px-4 py-2"
                        : "max-w-[78%] rounded-2xl bg-surface-1 px-4 py-2"
                }
            >
                {/*
                 * No `mentions`: the API does not resolve them for direct
                 * messages, so an `@handle` here is text and nothing more —
                 * which is exactly what `RichText` does without them. Links
                 * and bold still read.
                 */}
                <RichText
                    text={message.content}
                    tone={isMine ? "onFill" : "default"}
                />
            </Pressable>

            {isMine && isLatestMine && (
                <Text size="caption" tone="subtle" className="px-1 pt-0.5">
                    {isSeen ? t("messages.seen") : t("messages.sent")}
                </Text>
            )}

            <Modal
                visible={isConfirming}
                onClose={() => setIsConfirming(false)}
            >
                <View className="gap-4">
                    <View className="gap-2">
                        <Text size="title">{t("messages.deleteConfirm")}</Text>
                        <Text size="small" tone="muted">
                            {t("messages.deleteConfirmBody")}
                        </Text>
                    </View>

                    <View className="gap-2">
                        <Button
                            label={t("messages.deleteAction")}
                            variant="danger"
                            size="full"
                            onPress={() => {
                                setIsConfirming(false);
                                onDelete(message.id);
                            }}
                        />
                        <Button
                            label={t("messages.cancel")}
                            variant="ghost"
                            size="full"
                            onPress={() => setIsConfirming(false)}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

/**
 * Memoised because a thread redraws on every keystroke in the composer above
 * it, and every bubble but the newest is the same object it was.
 */
export const MessageBubble = memo(MessageBubbleView);
