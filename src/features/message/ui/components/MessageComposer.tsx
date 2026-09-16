import { Pressable, TextInput, View } from "react-native";
import { useState } from "react";

import { MESSAGE_MAX_LENGTH } from "../../data/message.types";
import { SendIcon } from "@shared/ui/icons/lucide";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { useSendMessage } from "../hooks/useSendMessage";

export interface MessageComposerProps {
    conversationId: string;
}

/** Past this the field stops growing and starts scrolling. */
const MAX_INPUT_HEIGHT = 120;

/** The counter appears only once the cap is close enough to matter. */
const COUNTER_THRESHOLD = MESSAGE_MAX_LENGTH - 200;

/**
 * Writing a message.
 *
 * The cap is the API's four thousand characters, mirrored so its 400 is
 * unreachable — and mirrored as a *counter* rather than as `maxLength`,
 * because a hard stop swallows a paste with no explanation while a counter
 * says what is wrong and lets the send control refuse.
 *
 * **The text comes back on a failure.** The bubble is optimistic, so a message
 * that failed has already left the field; putting it back is what makes the
 * next tap a retry rather than a retype — and under the same idempotency key,
 * so a send that in fact arrived is not sent twice.
 *
 * Attachments are their own pull request. The field is text for now.
 */
export function MessageComposer({ conversationId }: MessageComposerProps) {
    const { t } = useI18n();
    const { send, isSending, error, clearError } =
        useSendMessage(conversationId);

    const [content, setContent] = useState("");
    const [inputHeight, setInputHeight] = useState(0);

    const trimmed = content.trim();
    const isTooLong = trimmed.length > MESSAGE_MAX_LENGTH;
    const canSubmit = trimmed.length > 0 && !isTooLong && !isSending;

    const handleSend = async () => {
        if (!canSubmit) return;

        // Cleared before the request, because the bubble is already on screen
        // and a field still holding the text would read as unsent.
        setContent("");
        setInputHeight(0);

        /*
         * Handed back if it did not go — but never over the top of something
         * else. A send can take the full fifteen seconds of the request
         * budget, and somebody who gave up waiting and started typing the next
         * message would otherwise watch it be replaced by the one that failed.
         */
        if (!(await send(trimmed))) {
            setContent((typed) => (typed.length > 0 ? typed : trimmed));
        }
    };

    return (
        <View className="border-t border-ink/10 bg-ground px-3 py-2">
            <View className="flex-row items-end gap-2">
                <View
                    className={
                        isTooLong
                            ? "flex-1 flex-row items-center rounded-3xl border border-danger bg-surface-1 px-4"
                            : "flex-1 flex-row items-center rounded-3xl bg-surface-1 px-4"
                    }
                >
                    <TextInput
                        value={content}
                        onChangeText={(next) => {
                            setContent(next);
                            // Typing retracts the answer to the last attempt.
                            clearError();
                        }}
                        placeholder={t("messages.placeholder")}
                        multiline
                        // Grows with the text and then scrolls, so a long
                        // message neither pushes the thread off the screen nor
                        // hides its own first line.
                        onContentSizeChange={(event) =>
                            setInputHeight(event.nativeEvent.contentSize.height)
                        }
                        style={{
                            height: Math.min(
                                Math.max(inputHeight, 20),
                                MAX_INPUT_HEIGHT,
                            ),
                        }}
                        autoCapitalize="sentences"
                        className="flex-1 py-2.5 text-base text-ink placeholder:text-ink/35 selection:text-accent"
                    />
                </View>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("messages.send")}
                    accessibilityState={{ disabled: !canSubmit }}
                    disabled={!canSubmit}
                    onPress={() => void handleSend()}
                    className={
                        canSubmit
                            ? "mb-1 h-9 w-9 items-center justify-center rounded-full bg-ink active:bg-ink-hover"
                            : "mb-1 h-9 w-9 items-center justify-center rounded-full bg-surface-2"
                    }
                >
                    {isSending ? (
                        <Spinner />
                    ) : (
                        <SendIcon
                            size={16}
                            className={
                                canSubmit ? "text-ground" : "text-ink/30"
                            }
                        />
                    )}
                </Pressable>
            </View>

            {/*
             * Only an answer the writer has to act on — the write budget is
             * five a minute, which an ordinary exchange reaches. A failure of
             * ours leaves this empty and puts the text back in the field.
             */}
            {error && (
                <Text size="caption" tone="danger" className="pt-1">
                    {error}
                </Text>
            )}

            {trimmed.length > COUNTER_THRESHOLD && (
                <Text
                    size="caption"
                    tone={isTooLong ? "danger" : "subtle"}
                    className="pr-12 pt-1 text-right"
                >
                    {trimmed.length} / {MESSAGE_MAX_LENGTH}
                </Text>
            )}
        </View>
    );
}
