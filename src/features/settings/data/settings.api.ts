import { api } from "@core/api/client";
import type { AccountInfo, UpdatePasswordBody } from "./settings.types";

/**
 * The account, as opposed to the profile: the address it signs in with, the
 * name it is found by, and whether it exists at all.
 *
 * Every write answers 204 and is rate-limited strictly. None accepts an
 * idempotency key, and none needs one — each is a form somebody submits and
 * watches, not a post that would be duplicated by a retry.
 */
export const settingsApi = {
    getAccountInfo: () => api.get<AccountInfo>("/users/me"),

    /**
     * A 409 when the name is taken. The schema holds the value to nothing
     * else, which is why the rules in `account-rules.ts` are checked first.
     */
    updateUsername: (newUsername: string) =>
        api.patch<void>("/users/me/username", { newUsername }),

    /**
     * The API marks the address unverified as it stores it, so a successful
     * change leaves the account needing verification again.
     */
    updateEmail: (newEmail: string) =>
        api.patch<void>("/users/me/email", { newEmail }),

    updatePassword: (body: UpdatePasswordBody) =>
        api.patch<void>("/users/me/password", body),

    /**
     * A soft delete: the account can be recovered by signing in within thirty
     * days. The password is re-verified first, so `DELETE` carries a body —
     * one sent without it fails validation before reaching the check.
     *
     * The session outlives this request on purpose. The access token stays
     * valid (the API checks a token's account for a ban, not for deletion),
     * which is what lets the sign-out that follows retire this phone's push
     * registration and the refresh token before they are dropped.
     */
    deleteAccount: (password: string) =>
        api.delete<void>("/users/me", { body: JSON.stringify({ password }) }),
};
