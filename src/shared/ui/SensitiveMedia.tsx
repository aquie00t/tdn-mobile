import { Pressable } from "react-native";
import type { ReactNode } from "react";
import { useState } from "react";

import { HiddenIcon } from "./icons/lucide";
import { Text } from "./Text";
import { useI18n } from "../hooks/useI18n";

export interface SensitiveMediaProps {
    /**
     * Taken rather than assumed, so call sites wrap their media
     * unconditionally instead of each repeating the same ternary — and so the
     * next one cannot forget the cover.
     */
    isSensitive: boolean;
    children: ReactNode;
}

/**
 * The cover over media the server flagged `isSensitive`.
 *
 * ---------------------------------------------------------------------------
 * Why violent media reaches this component rather than being deleted
 * ---------------------------------------------------------------------------
 * Moderation refuses sexual content, gore, self-harm and hate symbols outright
 * — those never get a URL and never arrive here. Violence and weapons are
 * deliberately *not* refused; they are flagged and land under this cover
 * instead. This is a developers' platform and it is full of game screenshots,
 * and a filter that deletes those is a filter people spend their time working
 * around. So when someone asks why violence is not blocked: it is a decision,
 * not a gap.
 * ---------------------------------------------------------------------------
 *
 * The flag is content-level, so this wraps the whole media block rather than
 * one file — the server does not say which attachment it was.
 *
 * **The web blurs the media and covers it; this does not render it at all.**
 * React Native has no CSS blur, and the library that supplies one falls back to
 * a translucent wash below Android 12 — a cover that does not cover on exactly
 * the devices least able to complain about it. Not rendering is also the
 * stronger version of the same intent: nothing is fetched or decoded until
 * somebody asks for it.
 *
 * Revealing lasts as long as the card is mounted and is written nowhere, so
 * scrolling back to a post gets the cover again. That is the safer way round
 * for a decision this cheap to repeat.
 */
export function SensitiveMedia({ isSensitive, children }: SensitiveMediaProps) {
    const { t } = useI18n();
    const [isRevealed, setIsRevealed] = useState(false);

    if (!isSensitive || isRevealed) return <>{children}</>;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("media.sensitive")}
            accessibilityHint={t("media.sensitiveReveal")}
            onPress={() => setIsRevealed(true)}
            // The same 16:9 a single attachment would take, so revealing does
            // not shove the rest of the card up the screen.
            className="aspect-video w-full items-center justify-center gap-1 rounded-2xl border border-ink/10 bg-surface-2 active:bg-surface-3"
        >
            <HiddenIcon size={20} className="text-ink/60" />
            <Text size="small" className="font-semibold">
                {t("media.sensitive")}
            </Text>
            <Text size="caption" tone="subtle">
                {t("media.sensitiveReveal")}
            </Text>
        </Pressable>
    );
}
