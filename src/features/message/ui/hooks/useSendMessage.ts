import { useCallback, useRef, useState } from "react";

import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import type { Message } from "../../data/message.types";
import { messageApi } from "../../data/message.api";
import { newIdempotencyKey } from "@core/api/idempotency";
import { reportError } from "@shared/utils/report-error";
import { useMessageStore } from "../store/message.store";
import { useSessionStore } from "@core/session/session.store";

/**
 * Marks a bubble that exists only on this device. The prefix is what tells the
 * delete affordance apart from a real id — a message the server has not
 * acknowledged has nothing to withdraw.
 */
const TEMP_PREFIX = "temp-";

export const isPendingMessage = (id: string) => id.startsWith(TEMP_PREFIX);

/**
 * Sends a message, optimistically.
 *
 * The bubble appears immediately and is swapped for the server's copy on
 * success. On failure it is taken away again and **the text goes back into the
 * composer** — a message that silently vanished would be indistinguishable
 * from one that was sent, and here that difference matters more than it does
 * for a like.
 *
 * **One key for one message, held across retries.** This is the case the
 * caller-owned idempotency key exists for, and on a phone it is not
 * hypothetical: the send times out, nobody can say whether the server got it,
 * and the person taps send again. Under the same key the API answers from the
 * first attempt instead of posting twice. It is cleared once a message has
 * actually been created, which starts the next one fresh.
 *
 * **The key belongs to the text it was minted for**, which is why the attempt
 * is remembered as a pair. The composer hands a failed message back, and
 * nothing stops somebody editing it before trying again — under the old key
 * the API would replay the first attempt and put the *original* wording on
 * screen, with the edit silently discarded. Changed text is a new message and
 * gets a new key.
 */
export function useSendMessage(conversationId: string) {
    const addMessage = useMessageStore((s) => s.addMessage);
    const replaceMessage = useMessageStore((s) => s.replaceMessage);
    const removeMessage = useMessageStore((s) => s.removeMessage);
    const userId = useSessionStore((s) => s.user?.id);

    const [isSending, setIsSending] = useState(false);
    /** The server's answer, when it is one the writer has to act on. */
    const [error, setError] = useState<string | null>(null);

    /** The key in hand, and the body it was minted for. */
    const attempt = useRef<{ key: string; content: string } | null>(null);

    /**
     * @returns Whether it was sent. `false` leaves the text with the caller.
     */
    const send = useCallback(
        async (content: string): Promise<boolean> => {
            const tempId = `${TEMP_PREFIX}${Date.now()}`;
            const optimistic: Message = {
                id: tempId,
                conversationId,
                senderId: userId ?? "",
                content,
                mediaUrls: [],
                isSensitive: false,
                /*
                 * The server decides all three and says so in its reply.
                 * Guessing here would put a "being checked" placeholder under
                 * a message that has none, for the half-second before the
                 * real row arrives.
                 */
                mediaPending: false,
                mediaRejected: false,
                isDeleted: false,
                isMine: true,
                createdAt: new Date().toISOString(),
            };

            if (!attempt.current || attempt.current.content !== content) {
                attempt.current = { key: newIdempotencyKey(), content };
            }

            addMessage(optimistic);
            setIsSending(true);
            setError(null);

            try {
                const sent = await messageApi.sendMessage(
                    conversationId,
                    content,
                    attempt.current.key,
                );

                attempt.current = null;
                replaceMessage(tempId, sent);
                return true;
            } catch (err) {
                /*
                 * The bubble goes and the composer takes the text back, so
                 * nothing is lost and the next tap is a retry under the same
                 * key. The key is deliberately kept: a failure is exactly what
                 * it is for, and a fresh one would send the message twice if
                 * the first request had in fact arrived.
                 *
                 * What is *said* depends on whose failure it was. Ours — the
                 * network, a timeout, a 500 — says nothing and goes to
                 * `reportError`. The server's answer is shown, because the
                 * writer has to act on it: the write budget is five a minute,
                 * which an ordinary exchange reaches, and a request that is
                 * refused every time with nothing saying why is worse than a
                 * sentence.
                 */
                removeMessage(tempId);
                reportError("message.send", err);

                const message = getErrorMessage(err);
                if (!isOurFailure(message)) setError(message);
                return false;
            } finally {
                setIsSending(false);
            }
        },
        [conversationId, userId, addMessage, replaceMessage, removeMessage],
    );

    /** Typing retracts the answer to the previous attempt. */
    const clearError = useCallback(() => setError(null), []);

    return { send, isSending, error, clearError };
}
