import { Pressable, TextInput, View } from "react-native";
import { useRef, useState } from "react";

import { AddMediaIcon, SendIcon } from "@shared/ui/icons/lucide";
import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import { MEDIA_ENDPOINTS } from "@shared/utils/media-upload";
import { MediaPicker } from "@shared/ui/MediaPicker";
import {
    MESSAGE_MAX_LENGTH,
    MESSAGE_MAX_MEDIA,
} from "../../data/message.types";
import { reportError } from "@shared/utils/report-error";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { useMediaSelection } from "@shared/hooks/useMediaSelection";
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
 * **Attachments go to `/messages/media`, not `/media`.** The channel is fixed
 * when the bytes arrive, so a file uploaded for a post cannot be attached to a
 * message and the other way round — crossing them is `MediaNotOwnedError`,
 * which is a confusing thing to debug from this end.
 *
 * The library only, as in the comment box: two glyphs in a pill this narrow
 * leave the field about forty per cent of a 360px screen, and the camera stays
 * where there is room for it.
 */
export function MessageComposer({ conversationId }: MessageComposerProps) {
    const { t } = useI18n();
    const { send, isSending, error, clearError } =
        useSendMessage(conversationId);

    const media = useMediaSelection(MESSAGE_MAX_MEDIA, MEDIA_ENDPOINTS.message);

    const [content, setContent] = useState("");
    const [inputHeight, setInputHeight] = useState(0);
    /** The upload's own answer, when it is one the writer has to act on. */
    const [mediaError, setMediaError] = useState<string | null>(null);

    /**
     * The field as it stands right now, readable from inside an awaited call.
     *
     * An upload can take several seconds and the field is not frozen while it
     * runs — somebody attaching a video and carrying on typing is the ordinary
     * case, not an edge one. Sending the snapshot taken before the upload
     * would quietly discard everything typed since.
     */
    const latest = useRef(content);

    const trimmed = content.trim();
    const isTooLong = trimmed.length > MESSAGE_MAX_LENGTH;
    /*
     * Text or media, either alone. The API refuses a message carrying neither
     * with `EmptyMessageError`, and this is where that is kept unreachable.
     */
    const canSubmit =
        (trimmed.length > 0 || media.assets.length > 0) &&
        !isTooLong &&
        !isSending &&
        !media.isUploading;

    const handleSend = async () => {
        if (!canSubmit) return;

        setMediaError(null);

        /*
         * The upload comes first, and the field is cleared only once it is
         * done: until there are URLs there is no bubble to stand in for the
         * text, and clearing earlier would leave the message nowhere at all
         * for as long as the files take.
         */
        let mediaUrls: string[];

        try {
            mediaUrls = await media.upload();
        } catch (err) {
            /*
             * A verdict makes the whole selection unusable — the endpoint
             * returns no URLs once one file is refused, and nothing here knows
             * which one — so `handleFailure` empties the picker and the writer
             * chooses again. Every other failure keeps the files for a retry.
             */
            media.handleFailure(err);
            reportError("message.media", err);

            const message = getErrorMessage(err);
            if (!isOurFailure(message)) setMediaError(message);
            return;
        }

        // Read after the upload rather than before it, so what goes is what
        // the field holds at the moment the message actually leaves.
        const body = latest.current.trim();

        // Cleared now: the bubble is about to be on screen, and a field still
        // holding the text would read as unsent.
        setContent("");
        latest.current = "";
        setInputHeight(0);

        if (await send(body, mediaUrls)) {
            media.clear();
            return;
        }

        /*
         * Handed back if it did not go — but never over the top of something
         * else. A send can take the full fifteen seconds of the request
         * budget, and somebody who gave up waiting and started typing the next
         * message would otherwise watch it be replaced by the one that failed.
         *
         * The attachments stay in the picker for the same reason, and go back
         * up under the same idempotency key.
         */
        setContent((typed) => {
            const restored = typed.length > 0 ? typed : body;
            latest.current = restored;
            return restored;
        });
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
                            // Written here rather than during render: a ref is
                            // not state, and reading or writing one while
                            // rendering is how a component stops updating when
                            // it should.
                            latest.current = next;
                            // Typing retracts the answer to the last attempt.
                            clearError();
                            setMediaError(null);
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

                    {/*
                     * Inside the pill rather than on a row of its own. A
                     * permanent control row under a docked composer is height
                     * spent whether or not anybody attaches anything, and the
                     * thread above it wants the space.
                     */}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("messages.attach")}
                        /*
                         * Shut while a message is on its way, upload included.
                         * A file picked in that window would be cleared along
                         * with the ones that were sent, and vanish from the
                         * picker having never gone anywhere.
                         */
                        disabled={
                            isSending ||
                            media.isUploading ||
                            media.remainingSlots <= 0
                        }
                        onPress={() => void media.pickFromLibrary()}
                        hitSlop={8}
                        className={
                            media.remainingSlots <= 0
                                ? "pl-1 opacity-30"
                                : "pl-1"
                        }
                    >
                        <AddMediaIcon size={18} className="text-ink/50" />
                    </Pressable>
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
                    {isSending || media.isUploading ? (
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

            {/* The grid only, and only once something is in it. */}
            {media.assets.length > 0 && (
                <View className="pt-2">
                    <MediaPicker
                        showControls={false}
                        assets={media.assets}
                        onPickFromLibrary={() => void media.pickFromLibrary()}
                        onTakePhoto={() => void media.takePhoto()}
                        onRemove={media.removeAsset}
                        remainingSlots={media.remainingSlots}
                        max={media.max}
                        disabled={isSending || media.isUploading}
                    />
                </View>
            )}

            {/*
             * Only an answer the writer has to act on — a refused file, or the
             * write budget of five a minute, which an ordinary exchange
             * reaches. A failure of ours leaves this empty and puts the text
             * back in the field.
             */}
            {(error ?? mediaError) && (
                <Text size="caption" tone="danger" className="pt-1">
                    {error ?? mediaError}
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
