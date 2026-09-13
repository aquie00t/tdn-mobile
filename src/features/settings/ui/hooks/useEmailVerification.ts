import { useCallback, useState } from "react";

import { getErrorMessage } from "@shared/utils/error-handler";
import { useSessionStore } from "@core/session/session.store";
import { verificationApi } from "@shared/data/verification.api";

/**
 * Sending a code to the account's address, and checking the one typed back.
 *
 * Nothing is sent until asked. The sign-up flow sends on arrival, because
 * arriving there is the request; here the section sits on a page people open
 * for other reasons, and a code nobody asked for spends the account's
 * rate-limit budget and replaces one that might be in their inbox already.
 *
 * @param onVerified - Called once the server accepts the code.
 */
export function useEmailVerification(onVerified: () => void) {
    const updateUser = useSessionStore((s) => s.updateUser);

    const [hasSent, setHasSent] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const send = useCallback(async () => {
        setIsSending(true);
        setError(null);

        try {
            await verificationApi.sendVerification();
            setHasSent(true);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsSending(false);
        }
    }, []);

    const verify = useCallback(
        async (code: string) => {
            setIsVerifying(true);
            setError(null);

            try {
                await verificationApi.verifyEmail(code);
                updateUser({ isEmailVerified: true });
                onVerified();
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setIsVerifying(false);
            }
        },
        [updateUser, onVerified],
    );

    const clearError = useCallback(() => setError(null), []);

    return { hasSent, isSending, isVerifying, error, send, verify, clearError };
}
