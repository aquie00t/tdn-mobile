import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "../../../../tests/msw-server";

const keystore = vi.hoisted(() => new Map<string, string>());

vi.mock("expo-secure-store", () => ({
    getItemAsync: (key: string) => Promise.resolve(keystore.get(key) ?? null),
    setItemAsync: (key: string, value: string) => {
        keystore.set(key, value);
        return Promise.resolve();
    },
    deleteItemAsync: (key: string) => {
        keystore.delete(key);
        return Promise.resolve();
    },
}));

import { BASE_URL } from "@core/api/client";
import { OAUTH_REDIRECT_URI, oauthApi } from "./oauth.api";
import { clearTokens, setTokens } from "@core/session/tokens";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-10T00:00:00.000Z" },
    });

const session = {
    accessToken: "a",
    expiresAt: 1,
    refreshToken: "r",
    refreshTokenExpiresAt: 2,
    user: { id: "u1", username: "ada", isEmailVerified: true },
};

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("startUrl", () => {
    it("names the redirect the API's allow-list is configured with", () => {
        // Exact match, no prefix test: an address that does not appear in
        // `OAUTH_NATIVE_REDIRECT_ALLOWLIST` verbatim is a 400 before a browser
        // ever opens.
        expect(oauthApi.startUrl("google")).toBe(
            `${BASE}/oauth/google?redirect=tdn%3A%2F%2Foauth`,
        );
        expect(oauthApi.startUrl("github")).toBe(
            `${BASE}/oauth/github?redirect=tdn%3A%2F%2Foauth`,
        );
    });

    it("encodes the redirect it was given", () => {
        expect(oauthApi.startUrl("google")).toContain(
            encodeURIComponent(OAUTH_REDIRECT_URI),
        );
    });
});

describe("exchangeCode", () => {
    it("sends the code alone and unwraps the session", async () => {
        let body: unknown = null;

        server.use(
            http.post(`${BASE}/oauth/exchange`, async ({ request }) => {
                body = await request.json();
                return ok(session);
            }),
        );

        await expect(oauthApi.exchangeCode("code-1")).resolves.toEqual(session);

        // No `client` flag, and the endpoint accepts none. The channel was
        // fixed on the code when the flow started, from the redirect target it
        // was started for — a caller that could choose would let a browser
        // trade a code it can see for a thirty-day refresh token.
        expect(body).toEqual({ code: "code-1" });
    });

    it("is sent once, unauthenticated, when the code is refused", async () => {
        // A leftover session must not turn a spent code into a replay: the
        // replay costs a second of the three attempts per quarter hour this
        // route allows, and the refresh behind it reports the session expired
        // over a code that was simply already used.
        await setTokens({ accessToken: "stale", refreshToken: "old" });
        const sent: (string | null)[] = [];
        let refreshCalls = 0;

        server.use(
            http.post(`${BASE}/oauth/exchange`, ({ request }) => {
                sent.push(request.headers.get("Authorization"));
                return HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "UnauthorizedError",
                        status: 401,
                        detail: "Invalid or expired exchange code",
                        instance: "/",
                    },
                    { status: 401 },
                );
            }),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshCalls += 1;
                return new HttpResponse(null, { status: 401 });
            }),
        );

        await expect(oauthApi.exchangeCode("spent")).rejects.toMatchObject({
            status: 401,
        });

        expect(sent).toEqual([null]);
        expect(refreshCalls).toBe(0);
    });
});
