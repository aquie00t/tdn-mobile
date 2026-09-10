import type { SessionResponse } from "@core/api/api.types";

/** What `/auth/login` and `/auth/refresh` answer. Shared with the client. */
export type LoginResponse = SessionResponse;

/**
 * `/auth/register` answers the created account and **not a session** — which is
 * why registering is two requests, not one.
 */
export interface RegisterResponse {
    id: string;
    username: string;
    createdAt: string;
}

/**
 * Whether an account with this identifier **exists**.
 *
 * `true` means it does, and the flow goes to the password screen; `false` sends
 * it to registration. Traced through the API's `CheckUserUseCase`, which
 * returns `user !== null` — the name reads either way and getting it backwards
 * sends every returning account to a form that can only answer 409.
 */
export interface CheckResponse {
    check: boolean;
}

/** Mirrors of the API's schema, so a doomed request is never sent. */
export const AUTH_LIMITS = {
    identifierMax: 100,
    usernameMin: 3,
    usernameMax: 30,
    passwordMin: 8,
    /** Exactly eight, digits only. */
    otpLength: 8,
} as const;

export const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;
export const OTP_PATTERN = /^[0-9]+$/;

export interface RegisterBody {
    email: string;
    username: string;
    password: string;
}

export interface ResetPasswordBody {
    email: string;
    otp: string;
    newPassword: string;
}
