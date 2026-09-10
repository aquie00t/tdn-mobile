import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { useRouter } from "expo-router";

import { OAUTH_REDIRECT_URI, oauthApi } from "../../data/oauth.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { parseOAuthCallback } from "../../domain/oauth-callback";
import type { OAuthProvider } from "../../data/oauth.types";
import { useAuthActions } from "./useAuthActions";
import { useAuthFlowStore } from "../store/auth-flow.store";
import { useI18n } from "@shared/hooks/useI18n";

/**
 * Signing in through a provider, which on this client is four steps rather
 * than the web's one.
 *
 * The web navigates the whole tab to `/oauth/{provider}` and picks the code up
 * on the page it lands back on, so its "flow" is two files that never meet.
 * Here the browser is a modal the app opens and outlives: it hands the
 * redirect straight back, so the exchange happens without a second screen, and
 * `OAuthSuccessPage` has no counterpart.
 *
 * `openAuthSessionAsync` rather than `expo-auth-session`, whose
 * `makeRedirectUri()` answers differently per environment — and the API's
 * native allow-list is an exact match with nowhere to put "differently". The
 * provider dance belongs to the API either way; this end only opens an address
 * and reads the one it comes back on.
 */
export function useOAuth() {
    const { t } = useI18n();
    const router = useRouter();
    const { acceptSession } = useAuthActions();
    const setRecoveryToken = useAuthFlowStore((s) => s.setRecoveryToken);

    /** Which provider is mid-flow, so only its own button shows a spinner. */
    const [pending, setPending] = useState<OAuthProvider | null>(null);
    /**
     * The window between the browser closing and the session existing. Held
     * apart from `pending` because it is the only part with nothing on screen
     * to attach a spinner to — the browser is gone and the app is answering.
     */
    const [isExchanging, setIsExchanging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const signInWith = useCallback(
        async (provider: OAuthProvider) => {
            setError(null);
            setPending(provider);

            try {
                const result = await WebBrowser.openAuthSessionAsync(
                    oauthApi.startUrl(provider),
                    OAUTH_REDIRECT_URI,
                );

                // `cancel` is the sheet swiped away, `dismiss` the app taking
                // it back. Both are somebody changing their mind, and an error
                // under the button would be the app arguing with them.
                if (result.type !== "success") return;

                const callback = parseOAuthCallback(result.url);

                switch (callback.kind) {
                    case "code": {
                        setIsExchanging(true);
                        const session = await oauthApi.exchangeCode(
                            callback.code,
                        );
                        // Navigates on its own, so nothing follows it here.
                        await acceptSession(session);
                        return;
                    }

                    case "recovery":
                        setRecoveryToken(callback.recoveryToken);
                        router.push("/(auth)/recover-account");
                        return;

                    case "cancelled":
                        return;

                    case "failed":
                        // `invalid_state`, `missing_code`, `oauth_failed` —
                        // none of which mean anything to the person holding
                        // the phone, and none of which they can act on. The
                        // API says nothing more specific, so neither does
                        // this.
                        setError(t("error.unexpected"));
                        return;
                }
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setPending(null);
                setIsExchanging(false);
            }
        },
        [acceptSession, router, setRecoveryToken, t],
    );

    return {
        signInWith,
        /** The provider mid-flow, or `null`. */
        pending,
        isExchanging,
        error,
    };
}
