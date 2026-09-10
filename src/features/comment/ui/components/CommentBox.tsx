import { Pressable, TextInput, View } from "react-native";
import { useRef, useState } from "react";

import { Avatar } from "@shared/ui/Avatar";
import { COMMENT_MAX_LENGTH } from "../../data/comment.types";
import type { Comment, CommentTarget } from "../../data/comment.types";
import { commentApi } from "../../data/comment.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { newIdempotencyKey } from "@core/api/idempotency";
import { ProfileIcon, SendIcon } from "@shared/ui/icons/lucide";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";
import { useSessionStore } from "@core/session/session.store";
import { useToastStore } from "@shared/store/toast.store";

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
 * The web's composer also uploads media and completes `@handles`. Both are
 * their own PRs — uploads with the post composer in PR 11, mentions in PR 24.
 */
export function CommentBox({
    target,
    parentId,
    onCommentCreated,
    placeholder,
    isInline = false,
}: CommentBoxProps) {
    const { t } = useI18n();
    const addToast = useToastStore((s) => s.addToast);
    const avatarUrl = useSessionStore((s) => s.user?.avatarUrl);

    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [inputHeight, setInputHeight] = useState(0);

    /**
     * One key for one attempt to post *this* comment, held across retries.
     *
     * This is the whole reason the caller owns the key. Somebody whose request
     * timed out taps send again; the key is the same, so the API answers from
     * the first attempt instead of posting twice. It is cleared only once a
     * comment has actually been created, which starts the next one fresh.
     */
    const idempotencyKey = useRef<string | null>(null);

    const trimmed = content.trim();
    const isTooLong = trimmed.length > COMMENT_MAX_LENGTH;
    const canSubmit = trimmed.length > 0 && !isTooLong && !isSubmitting;

    const handleSubmit = async () => {
        if (!canSubmit) return;

        idempotencyKey.current ??= newIdempotencyKey();
        setIsSubmitting(true);

        try {
            const comment = await commentApi.createComment(
                target,
                { content: trimmed, parentId },
                idempotencyKey.current,
            );

            idempotencyKey.current = null;
            setContent("");
            setInputHeight(0);
            onCommentCreated(comment);
        } catch (err) {
            // The key is deliberately kept. A failure is exactly the case the
            // key exists for, and minting a new one on the retry would post
            // the comment twice if the first request had in fact arrived.
            addToast({ type: "error", message: getErrorMessage(err) });
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
                            ? "flex-1 justify-center rounded-3xl border border-danger bg-surface-1 px-4"
                            : "flex-1 justify-center rounded-3xl bg-surface-1 px-4"
                    }
                >
                    <TextInput
                        value={content}
                        onChangeText={setContent}
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
                        className="py-2.5 text-base text-ink placeholder:text-ink/35 selection:text-accent"
                    />
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
