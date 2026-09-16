import { useCallback, useState } from "react";
import { useRouter } from "expo-router";

import { getErrorMessage, isOurFailure } from "@shared/utils/error-handler";
import { messageApi } from "../../data/message.api";
import { reportError } from "@shared/utils/report-error";
import { useMessageStore } from "../store/message.store";

/**
 * Opens the thread with somebody and goes to it.
 *
 * "Open", not "create": a conversation is identified by the pair, so this is
 * idempotent and the same two accounts always land on the same thread. Whether
 * it arrives `ACCEPTED` or as a request depends on whether the recipient
 * follows the caller, and that is the server's to decide — nothing here works
 * it out, it reads `isRequest` and `canSend` off the answer.
 *
 * A pair whose conversation was declined comes back unchanged, with
 * `canSend: false`. Going there anyway is deliberate: the thread and its
 * history still exist, and a dead end that shows why is easier to understand
 * than a button that appears to do nothing.
 */
export function useOpenConversation() {
    const router = useRouter();
    const upsertConversation = useMessageStore((s) => s.upsertConversation);
    const [isOpening, setIsOpening] = useState(false);
    /** The server's answer, when it is one the reader has to act on. */
    const [error, setError] = useState<string | null>(null);

    const open = useCallback(
        async (recipientId: string) => {
            /*
             * Never send the request without one. `JSON.stringify` drops a key
             * whose value is `undefined`, so a caller passing one that is not
             * there produces `{}` — and the server can only answer that
             * `recipientId` is missing, which reads as a bug in the message
             * body rather than as a profile that never had an id. That is
             * exactly how this shipped on the web, so it is caught here as
             * well as at the call site.
             */
            if (!recipientId) {
                reportError(
                    "conversation.open",
                    "No recipient id was given, so no conversation was opened.",
                );
                return;
            }

            setIsOpening(true);
            setError(null);

            try {
                const conversation =
                    await messageApi.openConversation(recipientId);

                upsertConversation(conversation);
                router.push({
                    pathname: "/messages/[id]",
                    params: { id: conversation.id },
                });
            } catch (err) {
                /*
                 * `InvalidRecipientError` covers four cases with one status —
                 * yourself, a bot, an account pending deletion, and a block in
                 * either direction — and the server writes which. Nothing here
                 * can improve on that, so it is shown as written.
                 */
                reportError("conversation.open", err);

                const message = getErrorMessage(err);
                if (!isOurFailure(message)) setError(message);
            } finally {
                setIsOpening(false);
            }
        },
        [router, upsertConversation],
    );

    return { open, isOpening, error };
}
