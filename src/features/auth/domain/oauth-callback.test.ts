import { describe, expect, it } from "vitest";

import { parseOAuthCallback } from "./oauth-callback";

/** What the API actually redirects to; the scheme is `app.config.ts`'s. */
const REDIRECT = "tdn://oauth";

describe("parseOAuthCallback", () => {
    it("reads the exchange code", () => {
        expect(parseOAuthCallback(`${REDIRECT}?code=abc123`)).toEqual({
            kind: "code",
            code: "abc123",
        });
    });

    it("decodes a code exactly once", () => {
        // `appendParam` on the API concatenates an already-encoded value
        // rather than re-encoding, so one decode is right and two would eat a
        // literal percent out of the code.
        expect(parseOAuthCallback(`${REDIRECT}?code=a%2Bb%253Dc`)).toEqual({
            kind: "code",
            code: "a+b%3Dc",
        });
    });

    it("ignores a fragment", () => {
        expect(parseOAuthCallback(`${REDIRECT}?code=abc#done`)).toEqual({
            kind: "code",
            code: "abc",
        });
    });

    it("takes a code over anything else in the address", () => {
        // A finished flow is a finished flow. Only the exchange endpoint can
        // tell a real code from a spent one, so nothing here second-guesses it.
        expect(
            parseOAuthCallback(`${REDIRECT}?error=oauth_failed&code=abc`),
        ).toEqual({ kind: "code", code: "abc" });
    });

    it("carries a pending-deletion account to recovery", () => {
        expect(
            parseOAuthCallback(
                `${REDIRECT}?error=account_pending_deletion&recoveryToken=rec-1`,
            ),
        ).toEqual({ kind: "recovery", recoveryToken: "rec-1" });
    });

    it("reports a pending-deletion callback that carries no token", () => {
        // The token is the whole of what that branch offers. Started without
        // one, the recovery screen would have nothing to spend.
        expect(
            parseOAuthCallback(`${REDIRECT}?error=account_pending_deletion`),
        ).toEqual({ kind: "failed", reason: "account_pending_deletion" });
    });

    it.each(["google_access_denied", "github_access_denied"])(
        "treats %s as somebody changing their mind",
        (reason) => {
            expect(parseOAuthCallback(`${REDIRECT}?error=${reason}`)).toEqual({
                kind: "cancelled",
            });
        },
    );

    it.each(["invalid_state", "missing_code", "oauth_failed"])(
        "reports %s",
        (reason) => {
            expect(parseOAuthCallback(`${REDIRECT}?error=${reason}`)).toEqual({
                kind: "failed",
                reason,
            });
        },
    );

    it("reports an address with nothing in it", () => {
        expect(parseOAuthCallback(REDIRECT)).toEqual({
            kind: "failed",
            reason: "missing_code",
        });
    });

    it("reports an empty code rather than acting on one", () => {
        expect(parseOAuthCallback(`${REDIRECT}?code=`)).toEqual({
            kind: "failed",
            reason: "missing_code",
        });
    });

    it("keeps a malformed escape instead of throwing", () => {
        // `decodeURIComponent` throws a `URIError` on a stray percent, which
        // would surface as "an unexpected error occurred" over one character.
        expect(parseOAuthCallback(`${REDIRECT}?code=a%zzb`)).toEqual({
            kind: "code",
            code: "a%zzb",
        });
    });
});
