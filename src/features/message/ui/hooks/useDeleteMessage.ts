import { useCallback, useState } from "react";

import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import { messageApi } from "../../data/message.api";
import { reportError } from "@shared/utils/report-error";
import { useMessageStore } from "../store/message.store";

/**
 * Withdrawing a message.
 *
 * Optimistic, unlike accept and decline: the row stays on screen either way —
 * only its contents go — so there is a rollback worth having, and somebody
 * watching their own message needs to see it leave when they press the button
 * rather than a second later.
 *
 * What it leaves is a **tombstone**, and that is the server's design as much
 * as this screen's: the other participant may have replied to the message, and
 * closing the gap would leave their reply answering nothing.
 *
 * Not reversible on either side. The stored text is blanked and any
 * attachments are deleted from storage, which is why the bubble confirms
 * first.
 */
export function useDeleteMessage() {
    const markMessageDeleted = useMessageStore((s) => s.markMessageDeleted);
    const replaceMessage = useMessageStore((s) => s.replaceMessage);
    const [isDeleting, setIsDeleting] = useState(false);
    /** The server's answer, when it is one the reader has to act on. */
    const [error, setError] = useState<string | null>(null);

    const remove = useCallback(
        async (messageId: string) => {
            // Kept whole rather than as the fields the tombstone overwrites:
            // a rollback that restored four of them would quietly drop the
            // fifth the next time one is added.
            const previous = useMessageStore
                .getState()
                .messages.find((m) => m.id === messageId);

            markMessageDeleted(messageId);
            setIsDeleting(true);
            setError(null);

            try {
                await messageApi.deleteMessage(messageId);
            } catch (err) {
                if (previous) replaceMessage(messageId, previous);
                reportError("message.delete", err);

                const message = getErrorMessage(err);
                if (!isOurFailure(message)) setError(message);
            } finally {
                setIsDeleting(false);
            }
        },
        [markMessageDeleted, replaceMessage],
    );

    return { remove, isDeleting, error };
}
