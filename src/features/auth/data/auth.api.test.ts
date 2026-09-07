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

import { authApi } from "./auth.api";
import { clearTokens, setTokens } from "@core/session/tokens";

const BASE = "http://localhost:8080/api/v1";

function problem(detail: string, status: number, title = "UnauthorizedError") {
    return HttpResponse.json(
        { type: "about:blank", title, status, detail, instance: "/" },
        { status },
    );
}

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-07T00:00:00.000Z" },
    });

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("login", () => {
    it("names itself a native client, so the refresh token comes in the body", async () => {
        let body: unknown = null;
        server.use(
            http.post(`${BASE}/auth/login`, async ({ request }) => {
                body = await request.json();
                return ok({
                    accessToken: "a",
                    expiresAt: 1,
                    refreshToken: "r",
                    refreshTokenExpiresAt: 2,
                    user: { id: "u1", username: "ada", isEmailVerified: true },
                });
            }),
        );

        await authApi.login("ada", "hunter2");

        // Without this the API answers on the cookie channel, and a cookie is
        // something this client has no way to hold — the session would work
        // for fifteen minutes and then end.
        expect(body).toEqual({
            identifier: "ada",
            password: "hunter2",
            client: "native",
        });
    });

    it("is sent once and never refreshed when the password is wrong", async () => {
        // A leftover session must not turn a wrong password into a replay: the
        // replay halves a 3-per-15-minutes budget, and the refresh behind it
        // reports the session expired over a typo.
        await setTokens({ accessToken: "stale", refreshToken: "old" });
        const sent: (string | null)[] = [];
        let refreshCalls = 0;

        server.use(
            http.post(`${BASE}/auth/login`, ({ request }) => {
                sent.push(request.headers.get("Authorization"));
                return problem("Invalid credentials.", 401);
            }),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshCalls += 1;
                return problem("no", 401);
            }),
        );

        await expect(authApi.login("ada", "wrong")).rejects.toMatchObject({
            status: 401,
        });

        expect(sent).toEqual([null]);
        expect(refreshCalls).toBe(0);
    });
});

describe("check", () => {
    it("reports an account that exists", async () => {
        server.use(http.post(`${BASE}/auth/check`, () => ok({ check: true })));
        // `true` means it exists. Reversed, every returning account would be
        // sent to a registration form that can only answer 409.
        await expect(authApi.checkIdentifier("ada")).resolves.toEqual({
            check: true,
        });
    });
});

describe("logout", () => {
    it("names the refresh token it wants retired", async () => {
        await setTokens({ accessToken: "a", refreshToken: "r-1" });
        let body: unknown = null;

        server.use(
            http.post(`${BASE}/auth/logout`, async ({ request }) => {
                body = await request.json();
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await authApi.logout();

        // A browser is answered through its cookie and sends nothing. This
        // client has to say which token to retire, or the session outlives the
        // phone by thirty days.
        expect(body).toEqual({ refreshToken: "r-1" });
    });

    it("still asks when there is no token to name", async () => {
        let called = false;
        server.use(
            http.post(`${BASE}/auth/logout`, () => {
                called = true;
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await authApi.logout();
        expect(called).toBe(true);
    });
});
