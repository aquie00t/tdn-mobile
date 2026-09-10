import { BASE_URL, api } from "@core/api/client";
import type { LoginResponse } from "./auth.types";
import type { OAuthProvider } from "./oauth.types";

/**
 * Where the finished flow puts the exchange code.
 *
 * Two things have to agree with this string and neither will say so if they
 * stop: `scheme` in `app.config.ts`, which is what makes the phone answer the
 * address at all, and `OAUTH_NATIVE_REDIRECT_ALLOWLIST` on the API, which is
 * an **exact** match — no prefix test, no host comparison, because the target
 * receives the exchange code and a loose match would hand a session to
 * whoever owned the address. An unlisted target is a 400 on the first request,
 * before a browser ever opens.
 *
 * Written out rather than built with `makeRedirectUri()` for the same reason.
 * That helper answers differently per environment, and an exact-match list has
 * nowhere to put "differently".
 */
export const OAUTH_REDIRECT_URI = "tdn://oauth";

export const oauthApi = {
    /**
     * The address the in-app browser opens, and it must be *opened* rather
     * than fetched. The API sets a signed, httpOnly state cookie on this
     * request and reads it back at the provider's callback to prove the same
     * agent started the flow. Fetched from JavaScript the cookie lands in
     * React Native's jar, the callback finds nothing in the browser's, and
     * every attempt fails as `invalid_state`.
     */
    startUrl: (provider: OAuthProvider): string =>
        `${BASE_URL}/oauth/${provider}?redirect=${encodeURIComponent(
            OAUTH_REDIRECT_URI,
        )}`,

    /**
     * Trades the single-use code for a session.
     *
     * No `client` flag, deliberately — the channel was recorded on the code
     * when the flow started, from the redirect target it was started for. The
     * endpoint does not accept one and sending it is a 400.
     *
     * `isAnonymous` because this is called to *obtain* a session: no token is
     * sent, and a 401 is the endpoint's verdict on the code — spent, expired,
     * or never issued — rather than a stale session. Replayed, it would burn a
     * second of the three attempts per quarter hour this route allows and then
     * report the session as expired.
     */
    exchangeCode: (code: string) =>
        api.post<LoginResponse>(
            "/oauth/exchange",
            { code },
            {
                isAnonymous: true,
            },
        ),
};
