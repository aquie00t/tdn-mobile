import { useCallback } from "react";

import { settingsApi } from "../../data/settings.api";
import { useSessionStore } from "@core/session/session.store";
import { useSubmission } from "./useSubmission";

/**
 * Renames the account, and the session with it.
 *
 * The session is not just a label here: the profile tab reads whose profile to
 * open from it. Left on the old name, it would ask for a profile that no longer
 * exists and show a 404 where the reader's own page should be.
 */
export function useUpdateUsername() {
    const updateUser = useSessionStore((s) => s.updateUser);

    const action = useCallback(
        async (newUsername: string) => {
            await settingsApi.updateUsername(newUsername);
            updateUser({ username: newUsername });
        },
        [updateUser],
    );

    return useSubmission(action);
}
