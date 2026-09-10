import { useRouter } from "expo-router";
import { useCallback } from "react";

import { authApi } from "../../data/auth.api";
import { clearTokens, setTokens } from "@core/session/tokens";
import { useSessionStore } from "@core/session/session.store";
import { useAuthFlowStore } from "../store/auth-flow.store";
import type { LoginResponse } from "../../data/auth.types";

/**
 * A pending-deletion account, which `/auth/login` answers with a 403 carrying a
 * top-level `recoveryToken`.
 *
 * Recognised here so the two callers that meet it — the login screen and the
 * OAuth callback — can send somebody to the screen that spends the token
 * rather than reporting a dead end. The password was right; the account is
 * simply on its way out, and has thirty days in which that can be undone.
 */
export function isPendingDeletion(
    err: unknown,
): err is { status: number; recoveryToken: string } {
    return (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: unknown }).status === 403 &&
        "recoveryToken" in err
    );
}

export function useAuthActions() {
    const router = useRouter();
    const setSession = useSessionStore((s) => s.setSession);
    const clearSession = useSessionStore((s) => s.clearSession);
    const resetFlow = useAuthFlowStore((s) => s.reset);

    /**
     * Everything that has to happen once a session exists, in one place so
     * login and register-then-login cannot drift.
     *
     * Both tokens are stored: the access token for the next request, and the
     * refresh token that a native client is handed in the body and is expected
     * to keep. Where the account is unverified the flow continues to the code
     * screen rather than dismissing — the session is real either way, so this
     * is a prompt and not a gate.
     */
    const acceptSession = useCallback(
        async (data: LoginResponse) => {
            await setTokens({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
            });

            setSession({
                id: data.user.id,
                username: data.user.username,
                isEmailVerified: data.user.isEmailVerified ?? false,
            });

            if (data.user.isEmailVerified) {
                resetFlow();
                router.replace("/");
            } else {
                router.replace("/(auth)/verify-email");
            }
        },
        [router, setSession, resetFlow],
    );

    const signOut = useCallback(async () => {
        // Told to the server first, while the token still exists to name. A
        // failure here is logged and not surfaced: the phone is signing out
        // either way, and refusing to would strand somebody on an account they
        // asked to leave.
        try {
            await authApi.logout();
        } catch {
            // the session is being discarded regardless
        }
        await clearTokens();
        clearSession();
        resetFlow();
    }, [clearSession, resetFlow]);

    return { acceptSession, signOut };
}
