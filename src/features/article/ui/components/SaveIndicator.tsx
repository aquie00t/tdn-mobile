import { Pressable, View } from "react-native";

import { ARTICLE_LIMITS } from "../../domain/draft";
import type { DraftProblem } from "../../domain/draft";
import { CheckIcon } from "@shared/ui/icons/lucide";
import { MAX_MENTIONS } from "@shared/utils/mentions";
import type { SaveState } from "../hooks/useArticleEditor";
import { Spinner } from "@shared/ui/Spinner";
import { Text } from "@shared/ui/Text";
import { useI18n } from "@shared/hooks/useI18n";

export interface SaveIndicatorProps {
    state: SaveState;
    isDirty: boolean;
    /** What stops the draft being sent, or `null` when nothing does. */
    problem: DraftProblem | null;
    /** The server's answer, when it is one to act on. */
    error: string | null;
    onRetry: () => void;
}

/**
 * Whether the writing is safe.
 *
 * Autosave is invisible by design, which is exactly why it needs saying: a
 * writer who cannot tell whether their work is kept will not trust the editor.
 *
 * A failed save says so and offers a retry — that is not showing the writer our
 * error, it is telling them their text is not kept, which is theirs to know.
 * *Why* it failed is shown only when the server said something they can act on;
 * a network failure or a 5xx is "could not save" and nothing more.
 */
export function SaveIndicator({
    state,
    isDirty,
    problem,
    error,
    onRetry,
}: SaveIndicatorProps) {
    const { t } = useI18n();

    if (state === "error") {
        return (
            <View className="flex-row items-center gap-2">
                <Text
                    size="caption"
                    tone="danger"
                    numberOfLines={1}
                    className="shrink"
                >
                    {error ?? t("editor.saveFailed")}
                </Text>
                <Pressable
                    accessibilityRole="button"
                    onPress={onRetry}
                    hitSlop={8}
                >
                    <Text size="caption" tone="danger" className="underline">
                        {t("editor.retrySave")}
                    </Text>
                </Pressable>
            </View>
        );
    }

    if (state === "saving") {
        return (
            <View className="flex-row items-center gap-1.5">
                <Spinner size="small" />
                <Text size="caption" tone="subtle">
                    {t("editor.saving")}
                </Text>
            </View>
        );
    }

    // Nothing reaches the server while a limit is breached, so name the one
    // that is — "unsaved changes" would be true and useless.
    if (problem !== null) {
        return (
            <Text
                size="caption"
                tone={problem === "empty" ? "subtle" : "danger"}
                numberOfLines={1}
            >
                {problem === "empty"
                    ? t("editor.needsTitleAndBody")
                    : problem === "titleTooLong"
                      ? t("editor.titleTooLong", {
                            max: ARTICLE_LIMITS.titleMax,
                        })
                      : problem === "bodyTooLong"
                        ? t("editor.bodyTooLong", {
                              max: ARTICLE_LIMITS.bodyMax,
                          })
                        : problem === "tooManyMentions"
                          ? t("error.mentionLimit", { max: MAX_MENTIONS })
                          : t("editor.tooLarge")}
            </Text>
        );
    }

    if (isDirty) {
        return (
            <Text size="caption" tone="subtle">
                {t("editor.unsaved")}
            </Text>
        );
    }

    if (state === "saved") {
        return (
            <View className="flex-row items-center gap-1.5">
                <CheckIcon size={13} className="text-ink/40" />
                <Text size="caption" tone="subtle">
                    {t("editor.saved")}
                </Text>
            </View>
        );
    }

    return null;
}
