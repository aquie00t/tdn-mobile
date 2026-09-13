import { useCallback } from "react";

import type { UpdatePasswordBody } from "../../data/settings.types";
import { settingsApi } from "../../data/settings.api";
import { useSubmission } from "./useSubmission";

/**
 * Changes the password, given the current one.
 *
 * An account made through Google or GitHub has no current password to give,
 * and the API answers it with a 400 that says so and points at the reset flow.
 * That message is shown as it is: `/users/me` does not say whether a password
 * exists, so there is nothing to hide the form on.
 */
export function useUpdatePassword() {
    const action = useCallback(async (body: UpdatePasswordBody) => {
        await settingsApi.updatePassword(body);
    }, []);

    return useSubmission(action);
}
