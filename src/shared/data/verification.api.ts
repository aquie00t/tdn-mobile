import { api } from "@core/api/client";

/**
 * Confirming the account's email address, which two features ask for: the
 * sign-up flow straight after an account is made, and Settings for anybody who
 * skipped that — or who has just changed the address, which the API answers by
 * marking it unverified again.
 *
 * Both are authenticated. They email, and check against, the account the token
 * belongs to, so neither is `isAnonymous`: a 401 here is a stale session, not a
 * verdict on the code.
 */
export const verificationApi = {
    sendVerification: () =>
        api.post<{ sent: boolean }>("/auth/send-verification"),

    verifyEmail: (otp: string) =>
        api.post<{ verified: boolean }>("/auth/verify-email", { otp }),
};
