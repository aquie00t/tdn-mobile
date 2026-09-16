import { Pressable, TextInput, View } from "react-native";
import { useRef, useState } from "react";

import { Avatar } from "@shared/ui/Avatar";
import { COMMENT_MAX_LENGTH } from "../../data/comment.types";
import type { Comment, CommentTarget } from "../../data/comment.types";
import { commentApi } from "../../data/comment.api";
import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import { MediaPicker } from "@shared/ui/MediaPicker";
import { MentionSuggestions } from "@shared/ui/MentionSuggestions";
import { reportError } from "@shared/utils/report-error";
import { useMediaSelection } from "@shared/hooks/useMediaSelection";
import { useMentionAutocomplete } from "@shared/hooks/useMentionAutocomplete";
import { useMentionLimit } from "@shared/hooks/useMentionLimit";
import { newIdempotencyKey } from "@core/api/idempotency";
import { AddMediaIcon, ProfileIcon, SendIcon } from "@shared/ui/icons/lucide";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { useSessionStore } from "@core/session/session.store";

export interface CommentBoxProps {
    target: CommentTarget;
    /** Set to reply to a comment rather than to the target itself. */
    parentId?: string;
    onCommentCreated: (comment: Comment) => void;
    placeholder?: string;
    /**
     * Set when this sits inside a comment rather than under the thread. It
     * drops the rule and the ground behind it: those exist to separate the
     * docked composer from the list above it, and inside a card they draw a
     * second line through the middle of somebody's comment.
     */
    isInline?: boolean;
}

/** Past this the field stops growing and starts scrolling. */
const MAX_INPUT_HEIGHT = 120;

/** The counter appears only once the cap is close enough to matter. */
const COUNTER_THRESHOLD = COMMENT_MAX_LENGTH - 100;

/**
 * Writing a comment. Text only, for now.
 *
 * Shaped like the thing it is — a composer docked under a thread — rather than
 * like the form field it started as. Your own face on the left says whose
 * comment this will be; the field has no border of its own and grows with what
 * is typed, up to a point; and the send control is a disc that only lights up
 * once there is something to send. The first draft was a bordered input with a
 * button beside it, which is the shape of a sign-in screen.
 *
 * It uploads media and completes `@handles`, as the web's does.
 */
export function CommentBox({
    target,
    parentId,
    onCommentCreated,
    placeholder,
    isInline = false,
}: CommentBoxProps) {
    const { t } = useI18n();
    const avatarUrl = useSessionStore((s) => s.user?.avatarUrl);

    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [inputHeight, setInputHeight] = useState(0);
    /** The server's answer, when it is one the writer has to act on. */
    const [error, setError] = useState<string | null>(null);

    /**
     * One key for one attempt to post *this* comment, held across retries.
     *
     * This is the whole reason the caller owns the key. Somebody whose request
     * timed out taps send again; the key is the same, so the API answers from
     * the first attempt instead of posting twice. It is cleared only once a
     * comment has actually been created, which starts the next one fresh.
     */
    const idempotencyKey = useRef<string | null>(null);

    const media = useMediaSelection();
    const mention = useMentionAutocomplete(content);
    const mentionLimit = useMentionLimit(content);

    const trimmed = content.trim();
    const isTooLong = trimmed.length > COMMENT_MAX_LENGTH;
    const canSubmit =
        (trimmed.length > 0 || media.assets.length > 0) &&
        !isTooLong &&
        !mentionLimit.isOverLimit &&
        !isSubmitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;

        idempotencyKey.current ??= newIdempotencyKey();
        setIsSubmitting(true);
        setError(null);

        try {
            const mediaUrls = await media.upload();

            const comment = await commentApi.createComment(
                target,
                { content: trimmed, parentId, mediaUrls },
                idempotencyKey.current,
            );

            idempotencyKey.current = null;
            setContent("");
            setInputHeight(0);
            media.clear();
            onCommentCreated(comment);
        } catch (err) {
            // Nothing is lost: the text stays in the box and the send control
            // comes back. The key is deliberately kept — a failure is exactly
            // the case it exists for, and a new one on the retry would post
            // the comment twice if the first request had in fact arrived.
            //
            // Our failure says nothing; the server's answer — a refused file,
            // which `handleFailure` has just taken out of the picker, or a
            // rate limit — is shown under the box, as in the post composer.
            media.handleFailure(err);
            reportError("comment.create", err);

            const message = getErrorMessage(err);
            if (!isOurFailure(message)) setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View
            className={
                isInline ? "py-1" : "border-t border-ink/10 bg-ground px-3 py-2"
            }
        >
            {/*
             * Above the field, not under it. This box is docked at the bottom
             * of the thread with the keyboard beneath it, so a list under the
             * field would open into the keyboard; the post composer, which has
             * a whole screen, puts its list the other way round.
             */}
            {mention.isOpen && (
                <View className="pb-2 pl-10">
                    <MentionSuggestions
                        isSearching={mention.isSearching}
                        suggestions={mention.suggestions}
                        onSelect={(item) => {
                            const next = mention.select(item);
                            if (next === null) return;
                            setContent(next);
                            // Choosing an account is typing, and typing
                            // retracts the answer to the last attempt.
                            setError(null);
                        }}
                    />
                </View>
            )}

            <View className="flex-row items-end gap-2">
                {avatarUrl ? (
                    <Avatar uri={avatarUrl} size={32} className="mb-1" />
                ) : (
                    <View className="mb-1 h-8 w-8 items-center justify-center rounded-full border border-ink/10 bg-ink/5">
                        <ProfileIcon size={16} className="text-ink/40" />
                    </View>
                )}

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
                            setError(null);
                        }}
                        onSelectionChange={mention.onSelectionChange}
                        // Controlled for the one render after an insertion and
                        // `undefined` otherwise, or the field fights the
                        // person typing into it.
                        selection={mention.selection}
                        placeholder={placeholder ?? t("commentBox.placeholder")}
                        multiline
                        // Grows with the text and then scrolls, so a long
                        // comment neither pushes the thread off the screen nor
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
                        // No `maxLength`. A hard stop swallows a paste with no
                        // explanation; the counter says what is wrong and the
                        // control refuses, which is something to act on.
                        autoCapitalize="sentences"
                        className="flex-1 py-2.5 text-base text-ink placeholder:text-ink/35 selection:text-accent"
                    />

                    {/*
                     * Inside the pill rather than on a row of its own. A
                     * permanent control row under every comment box is height
                     * spent whether or not anybody attaches anything, and this
                     * box sits under a thread that wants the space.
                     *
                     * The library only — the camera stays in the post
                     * composer. Two icons in a pill this narrow leaves the
                     * field about forty per cent of a 360px screen.
                     */}
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("postBox.media")}
                        disabled={isSubmitting || media.remainingSlots <= 0}
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
                    accessibilityLabel={t("commentBox.reply")}
                    accessibilityState={{ disabled: !canSubmit }}
                    disabled={!canSubmit}
                    onPress={() => void handleSubmit()}
                    className={
                        canSubmit
                            ? "mb-1 h-9 w-9 items-center justify-center rounded-full bg-ink active:bg-ink-hover"
                            : "mb-1 h-9 w-9 items-center justify-center rounded-full bg-surface-2"
                    }
                >
                    {isSubmitting ? (
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
                <View className="pl-10 pt-2">
                    <MediaPicker
                        showControls={false}
                        assets={media.assets}
                        onPickFromLibrary={() => void media.pickFromLibrary()}
                        onTakePhoto={() => void media.takePhoto()}
                        onRemove={media.removeAsset}
                        remainingSlots={media.remainingSlots}
                        max={media.max}
                        disabled={isSubmitting}
                    />
                </View>
            )}

            {error && (
                <Text size="caption" tone="danger" className="pl-10 pt-1">
                    {error}
                </Text>
            )}

            {/* The send control is already refusing; this says why. */}
            {mentionLimit.isOverLimit && (
                <Text size="caption" tone="danger" className="pl-10 pt-1">
                    {t("error.mentionLimit", { max: mentionLimit.max })}
                </Text>
            )}

            {trimmed.length > COUNTER_THRESHOLD && (
                <Text
                    size="caption"
                    tone={isTooLong ? "danger" : "subtle"}
                    className="pr-12 pt-1 text-right"
                >
                    {trimmed.length} / {COMMENT_MAX_LENGTH}
                </Text>
            )}
        </View>
    );
}
