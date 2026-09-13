import { useState } from "react";
import { Pressable } from "react-native";

import { ReportDialog } from "./ReportDialog";
import { ReportIcon } from "./icons/lucide";
import type { ReportTargetKind } from "../data/report.types";
import { useI18n } from "../hooks/useI18n";

export interface ReportButtonProps {
    targetKind: ReportTargetKind;
    targetId: string;
    /** Matches the card's other controls. */
    size?: number;
}

/**
 * The report control on a post or a comment card.
 *
 * In `shared/` because two features draw it. It sits where a delete control
 * would sit on your own content, and the card shows it only on somebody
 * else's — see `isOwnContent`.
 *
 * A tap here never opens the post behind it: nested pressables hand the touch
 * to the innermost one. A tap *inside the dialog* is the case to watch —
 * React Native bubbles touches through the component tree, not the native
 * windows, so the dialog still sits inside the card's `Pressable`. `Modal`'s
 * panel claims its own touches for exactly that reason.
 *
 * The dialog is mounted only while open, so nine reasons and a text field are
 * not kept alive behind every card in a feed.
 */
export function ReportButton({
    targetKind,
    targetId,
    size = 16,
}: ReportButtonProps) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("report.action")}
                onPress={() => setIsOpen(true)}
                hitSlop={10}
                className="flex-row items-center"
            >
                <ReportIcon size={size} className="text-ink/40" />
            </Pressable>

            {isOpen && (
                <ReportDialog
                    visible
                    onClose={() => setIsOpen(false)}
                    targetKind={targetKind}
                    targetId={targetId}
                />
            )}
        </>
    );
}
