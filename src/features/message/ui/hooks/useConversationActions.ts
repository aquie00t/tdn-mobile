import { useCallback, useState } from "react";

import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import type { Conversation } from "../../data/message.types";
import { messageApi } from "../../data/message.api";
import { reportError } from "@shared/utils/report-error";
import { useMessageStore } from "../store/message.store";

/**
 * Answering a message request: accept, or decline.
 *
 * **Neither is optimistic**, and that is the difference from a like. Both
 * answer with the conversation itself, so guessing its new shape only to
 * overwrite it a moment later would buy nothing; and decline is terminal, so a
 * rollback would be putting back a thread that can never come back. The row
 * stays where it is, disabled, until the server says what happened.
 *
 * A failure that is ours says nothing to the reader and goes to `reportError`.
 * The server's own answer is shown beside the buttons, because it is one they
 * have to act on: these writes are capped at **five a minute**, which somebody
 * clearing a handful of requests in one sitting can reach, and a 429 that said
 * nothing would look like two buttons that had stopped working.
 *
 * One instance per row, so the busy state and the message belong to the
 * request they were raised by.
 */
export function useConversationActions() {
    const upsertConversation = useMessageStore((s) => s.upsertConversation);
    /**
     * Which of the two is running, not merely that one is. Both controls are
     * disabled either way; the spinner has to be on the one that was pressed,
     * or declining spins the accept button.
     */
    const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(
        async (
            action: "accept" | "decline",
            request: () => Promise<Conversation>,
        ) => {
            setBusy(action);
            setError(null);

            try {
                upsertConversation(await request());
            } catch (err) {
                reportError(`conversation.${action}`, err);

                const message = getErrorMessage(err);
                if (!isOurFailure(message)) setError(message);
            } finally {
                setBusy(null);
            }
        },
        [upsertConversation],
    );

    const accept = useCallback(
        (conversationId: string) =>
            run("accept", () => messageApi.acceptConversation(conversationId)),
        [run],
    );

    const decline = useCallback(
        (conversationId: string) =>
            run("decline", () =>
                messageApi.declineConversation(conversationId),
            ),
        [run],
    );

    return { accept, decline, busy, isBusy: busy !== null, error };
}
