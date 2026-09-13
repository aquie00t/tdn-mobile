import { useCallback, useRef } from "react";

import { isNetworkError } from "@shared/utils/error-handler";
import { settingsApi } from "../../data/settings.api";
import { useSubmission } from "./useSubmission";

function isNotFound(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: unknown }).status === 404
    );
}

/**
 * Deletes the account, then ends the session on this phone.
 *
 * `onDeleted` is the sign-out, handed down from the route because it belongs
 * to the auth feature. The order is the API's to dictate: deletion first,
 * while the password can still be checked, then sign-out — which retires the
 * push registration and the refresh token with an access token that still
 * works, because the API checks a token's account for a ban and not for
 * deletion. The other way round there would be no session to delete with.
 *
 * A wrong password is a 400 and leaves everything as it was.
 */
export function useDeleteAccount(onDeleted: () => Promise<void>) {
    /**
     * Whether an earlier attempt may have deleted the account without its
     * answer arriving.
     *
     * The API marks the account deleted *first* and then waits on the payment
     * provider and the mail service before it answers, which can outlast the
     * client's fifteen seconds. That attempt reports a network error while the
     * account is already gone, and the retry is answered 404 — the deleted
     * account cannot be found to delete. Taken at its word, that 404 would
     * leave somebody signed in to an account that no longer exists, told the
     * deletion failed.
     *
     * So a 404 counts as done only after a network error: on its own it is
     * also what an account with no password is answered, and signing that one
     * out would be a failure reported as a success. Held for the life of the
     * dialog, not per attempt, because the account is gone either way.
     */
    const mayHaveLandedRef = useRef(false);

    const action = useCallback(
        async (password: string) => {
            try {
                await settingsApi.deleteAccount(password);
            } catch (err) {
                if (isNetworkError(err)) mayHaveLandedRef.current = true;

                const alreadyDeleted =
                    mayHaveLandedRef.current && isNotFound(err);

                if (!alreadyDeleted) throw err;
            }

            await onDeleted();
        },
        [onDeleted],
    );

    return useSubmission(action);
}
