import { useCallback } from "react";

import { settingsApi } from "../../data/settings.api";
import { useSessionStore } from "@core/session/session.store";
import { useSubmission } from "./useSubmission";

/**
 * Changes the address the account signs in with.
 *
 * The API stores the new address as unverified, and the session is told so
 * too. The web leaves both saying "verified" until the next page load, which
 * is a claim about an inbox nobody has checked.
 */
export function useUpdateEmail() {
    const updateUser = useSessionStore((s) => s.updateUser);

    const action = useCallback(
        async (newEmail: string) => {
            await settingsApi.updateEmail(newEmail);
            updateUser({ isEmailVerified: false });
        },
        [updateUser],
    );

    return useSubmission(action);
}
