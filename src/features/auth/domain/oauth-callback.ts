/**
 * What the API redirected back to `tdn://oauth` with.
 *
 * Every exit from the OAuth callback is a redirect — it runs in a browser
 * being sent back from a provider, so there is nobody to read a problem
 * document and the only way to report anything is to put it in the address.
 * These four cases are the whole of what `OAuthController.finish` can put
 * there.
 */
export type OAuthCallback =
    | { kind: "code"; code: string }
    /**
     * The account is scheduled for deletion, and this token is what recovers
     * it. The API sends it as an `error`, but it is not a failure: it is the
     * one branch that continues rather than stops.
     */
    | { kind: "recovery"; recoveryToken: string }
    /** The provider's own consent screen was declined. Nothing to report. */
    | { kind: "cancelled" }
    | { kind: "failed"; reason: string };

/** `google_access_denied`, `github_access_denied` — one per provider. */
const ACCESS_DENIED = "_access_denied";

/**
 * Reads a callback URL's query string.
 *
 * Hand-rolled rather than through `URLSearchParams`, which is the obvious
 * reach and the wrong one: React Native polyfills it partially and Node ships
 * it whole, so a spec written against Node passes while the phone reads
 * nothing. Eight lines here behave the same in both.
 *
 * The values arrive `encodeURIComponent`-encoded exactly once — the API's
 * `appendParam` concatenates rather than re-encoding — so one decode is right.
 * A malformed escape decodes to itself instead of throwing, because a
 * `URIError` here would surface as "an unexpected error occurred" over a
 * character.
 *
 * @param url - The redirect the browser came back on
 * @returns The parameters, by name
 */
function queryOf(url: string): Map<string, string> {
    const params = new Map<string, string>();
    const start = url.indexOf("?");

    if (start === -1) return params;

    const query = url.slice(start + 1).split("#")[0];

    for (const pair of query.split("&")) {
        if (!pair) continue;

        const eq = pair.indexOf("=");
        const rawKey = eq === -1 ? pair : pair.slice(0, eq);
        const rawValue = eq === -1 ? "" : pair.slice(eq + 1);

        params.set(decode(rawKey), decode(rawValue));
    }

    return params;
}

function decode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/**
 * Turns the redirect the browser came back on into what should happen next.
 *
 * `code` is checked first and on its own: a callback carrying one is a
 * finished flow whatever else is in the address, and the exchange endpoint is
 * the only thing that can tell a real code from a stale one anyway.
 *
 * Anything unrecognised — no parameters at all, an `error` nobody has seen
 * before, a truncated address — is `failed`. A callback this app cannot read
 * is not a callback it should act on.
 *
 * @param url - The redirect the browser came back on
 * @returns What the flow produced
 */
export function parseOAuthCallback(url: string): OAuthCallback {
    const params = queryOf(url);

    const code = params.get("code");
    if (code) return { kind: "code", code };

    const reason = params.get("error");

    if (reason === "account_pending_deletion") {
        const recoveryToken = params.get("recoveryToken");

        // The token is the entire point of this branch. Without one there is
        // nothing to offer, so it is reported rather than half-started.
        return recoveryToken
            ? { kind: "recovery", recoveryToken }
            : { kind: "failed", reason };
    }

    if (reason?.endsWith(ACCESS_DENIED)) return { kind: "cancelled" };

    return { kind: "failed", reason: reason ?? "missing_code" };
}
