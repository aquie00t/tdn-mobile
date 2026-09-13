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
