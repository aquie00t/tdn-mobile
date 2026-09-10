import { api } from "@core/api/client";
import { getRefreshToken } from "@core/session/tokens";
import type {
    CheckResponse,
    LoginResponse,
    RegisterBody,
    RegisterResponse,
    ResetPasswordBody,
} from "./auth.types";

/**
 * Everything here except `sendVerification`, `verifyEmail` and `logout` runs
 * *before* there is a session, so it is `isAnonymous` rather than `isPublic`.
 *
 * The difference matters more than it looks. A 401 from these endpoints is
 * their verdict on the credentials supplied — "that password is wrong" — not a
 * stale token. Flagged `isPublic`, the client would replay the request without
 * the header and then refresh in the background: the replay halves a
 * 3-per-15-minutes budget on `/auth/login`, and the refresh fails and reports
 * the session expired, throwing somebody who mistyped a password back to the
 * start with a message they never got to read.
 */
export const authApi = {
    /** Whether the account exists. See `CheckResponse`. */
    checkIdentifier: (identifier: string) =>
        api.post<CheckResponse>(
            "/auth/check",
            { identifier },
            { isAnonymous: true },
        ),

    /**
     * `client: "native"` is what puts the refresh token in the response body
     * instead of a cookie this app has no way to hold.
     */
    login: (identifier: string, password: string) =>
        api.post<LoginResponse>(
            "/auth/login",
            { identifier, password, client: "native" },
            { isAnonymous: true },
        ),

    register: (body: RegisterBody) =>
        api.post<RegisterResponse>("/auth/register", body, {
            isAnonymous: true,
        }),

    /** Authenticated: it emails the account the token belongs to. */
    sendVerification: () =>
        api.post<{ sent: boolean }>("/auth/send-verification"),

    verifyEmail: (otp: string) =>
        api.post<{ verified: boolean }>("/auth/verify-email", { otp }),

    forgotPassword: (email: string) =>
        api.post<void>(
            "/auth/forgot-password",
            { email },
            { isAnonymous: true },
        ),

    resetPassword: (body: ResetPasswordBody) =>
        api.post<{ reset: boolean }>("/auth/reset-password", body, {
            isAnonymous: true,
        }),

    /**
     * Sends the refresh token in the body, on the same channel it arrived on.
     * A browser is answered through its cookie and sends nothing; this client
     * has to name the token it wants retired, or the session stays alive on the
     * server for thirty days after the phone has forgotten it.
     */
    logout: async () => {
        const refreshToken = await getRefreshToken();
        return api.post<void>(
            "/auth/logout",
            refreshToken ? { refreshToken } : {},
        );
    },
};
