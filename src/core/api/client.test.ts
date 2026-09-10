import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { server } from "../../../tests/msw-server";

/**
 * A `Map` standing in for the Android keystore. `expo-secure-store` is a native
 * module and cannot load off-device, so something has to take its place — and
 * a real store rather than stubs, because the token layer's whole job is what
 * it reads back after a write.
 *
 * Hoisted above the imports, since `tokens.ts` reaches the module as it loads.
 */
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

import { BASE_URL, api, registerSessionExpiredHandler } from "./client";
import { SecureKeys } from "../platform/secure-storage.port";
import {
    clearTokens,
    getAccessToken,
    loadTokens,
    setTokens,
} from "../session/tokens";

/**
 * Taken from the client rather than written out again. The default moved to
 * production once it became clear that `localhost` on a phone is the phone, and
 * every handler in this file silently stopped matching — a hardcoded copy turns
 * a one-line change into nineteen unexplained failures.
 */
const BASE = BASE_URL;

/** The API renders every error as an RFC 7807 problem document. */
function problem(detail: string, status: number, title = "UnauthorizedError") {
    return HttpResponse.json(
        { type: "about:blank", title, status, detail, instance: "/" },
        { status },
    );
}

/** The `{ data, meta }` envelope every success is wrapped in. */
function ok<T>(data: T, meta?: unknown) {
    return HttpResponse.json({
        data,
        meta: meta ?? { timestamp: new Date().toISOString() },
    });
}

/**
 * A refresh answered on the body channel — which always rotates, returning a
 * new refresh token beside the new access token.
 */
function session(accessToken: string, refreshToken: string) {
    return ok({
        accessToken,
        expiresAt: Math.floor(Date.now() / 1000) + 900,
        refreshToken,
        refreshTokenExpiresAt: Math.floor(Date.now() / 1000) + 2_592_000,
        user: { id: "u1", username: "ada" },
    });
}

let sessionExpired: Mock<() => void>;

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    sessionExpired = vi.fn<() => void>();
    registerSessionExpiredHandler(sessionExpired);
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

/** Puts a usable pair in the keystore and in the in-memory mirror. */
async function signIn(access = "stale-token", refresh = "refresh-1") {
    await setTokens({ accessToken: access, refreshToken: refresh });
}

describe("token storage", () => {
    it("does not serve a token until the keystore has been read", async () => {
        keystore.set(SecureKeys.accessToken, "from-keystore");

        // The mirror is empty until `loadTokens` resolves, so a request made
        // before boot finishes is sent unauthenticated rather than with a
        // stale value.
        expect(getAccessToken()).toBeNull();

        await loadTokens();
        expect(getAccessToken()).toBe("from-keystore");
    });

    it("leaves the stored refresh token alone when a response omits one", async () => {
        await signIn("access-1", "refresh-1");
        await setTokens({ accessToken: "access-2" });

        // Erasing it here would sign the account out at the next refresh.
        expect(keystore.get(SecureKeys.refreshToken)).toBe("refresh-1");
        expect(keystore.get(SecureKeys.accessToken)).toBe("access-2");
    });
});

describe("a stale session is renewed once", () => {
    it("refreshes and replays the original request", async () => {
        await signIn();
        let postsCalls = 0;

        server.use(
            http.get(`${BASE}/posts`, ({ request }) => {
                postsCalls += 1;
                const auth = request.headers.get("Authorization");
                if (auth === "Bearer fresh-token") return ok([{ id: "p1" }]);
                return problem("Token expired.", 401);
            }),
            http.post(`${BASE}/auth/refresh`, () =>
                session("fresh-token", "refresh-2"),
            ),
        );

        await expect(api.get("/posts")).resolves.toEqual([{ id: "p1" }]);
        expect(postsCalls).toBe(2);
    });

    it("stores the rotated refresh token, not just the access token", async () => {
        await signIn("stale-token", "refresh-1");

        server.use(
            http.get(`${BASE}/me`, ({ request }) =>
                request.headers.get("Authorization") === "Bearer fresh-token"
                    ? ok({ id: "u1" })
                    : problem("Token expired.", 401),
            ),
            http.post(`${BASE}/auth/refresh`, () =>
                session("fresh-token", "refresh-2"),
            ),
        );

        await api.get("/me");

        // Dropping this would work until the old token is retired, and then
        // look to the server exactly like a replay.
        expect(keystore.get(SecureKeys.refreshToken)).toBe("refresh-2");
        expect(getAccessToken()).toBe("fresh-token");
    });

    it("sends the stored refresh token in the body, with no cookie", async () => {
        await signIn("stale-token", "refresh-1");
        let refreshBody: unknown = null;

        server.use(
            http.get(`${BASE}/me`, ({ request }) =>
                request.headers.get("Authorization") === "Bearer fresh-token"
                    ? ok({ id: "u1" })
                    : problem("Token expired.", 401),
            ),
            http.post(`${BASE}/auth/refresh`, async ({ request }) => {
                refreshBody = await request.json();
                return session("fresh-token", "refresh-2");
            }),
        );

        await api.get("/me");
        expect(refreshBody).toEqual({ refreshToken: "refresh-1" });
    });

    it("renews once for several requests that fail together", async () => {
        await signIn();
        let refreshCalls = 0;

        server.use(
            http.get(`${BASE}/a`, ({ request }) =>
                request.headers.get("Authorization") === "Bearer fresh-token"
                    ? ok("a")
                    : problem("Token expired.", 401),
            ),
            http.get(`${BASE}/b`, ({ request }) =>
                request.headers.get("Authorization") === "Bearer fresh-token"
                    ? ok("b")
                    : problem("Token expired.", 401),
            ),
            http.get(`${BASE}/c`, ({ request }) =>
                request.headers.get("Authorization") === "Bearer fresh-token"
                    ? ok("c")
                    : problem("Token expired.", 401),
            ),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshCalls += 1;
                return session("fresh-token", "refresh-2");
            }),
        );

        await expect(
            Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]),
        ).resolves.toEqual(["a", "b", "c"]);

        // Three refreshes would spend a 5-per-minute budget at once, and the
        // later two would present a token the first has already consumed.
        expect(refreshCalls).toBe(1);
    });

    it("does not ask to renew when there is no refresh token to present", async () => {
        // An access token with nothing behind it — the shape a half-cleared
        // session leaves.
        await setTokens({ accessToken: "stale-token" });
        let refreshCalls = 0;

        server.use(
            http.get(`${BASE}/me`, () => problem("Token expired.", 401)),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshCalls += 1;
                return problem("Session not found", 401);
            }),
        );

        await expect(api.get("/me")).rejects.toThrow("Session Expired");
        expect(refreshCalls).toBe(0);
    });
});

describe("a refresh that fails ends the session", () => {
    it("clears both tokens and reports it once", async () => {
        await signIn();

        server.use(
            http.get(`${BASE}/me`, () => problem("Token expired.", 401)),
            http.post(`${BASE}/auth/refresh`, () =>
                problem(
                    "Security alert: Session compromised. All sessions revoked.",
                    401,
                ),
            ),
        );

        await expect(api.get("/me")).rejects.toThrow("Session Expired");

        expect(keystore.get(SecureKeys.accessToken)).toBeUndefined();
        expect(keystore.get(SecureKeys.refreshToken)).toBeUndefined();
        expect(getAccessToken()).toBeNull();
        expect(sessionExpired).toHaveBeenCalledTimes(1);
    });
});

describe("endpoints that are asked without a session", () => {
    it("sends an anonymous request once and never refreshes it", async () => {
        // A leftover token from a previous session is not a credential for
        // these endpoints, and sending it invites an answer about the wrong
        // subject entirely.
        await signIn();
        const sent: (string | null)[] = [];
        let refreshCalls = 0;

        server.use(
            http.post(`${BASE}/auth/login`, ({ request }) => {
                sent.push(request.headers.get("Authorization"));
                return problem("Invalid credentials.", 401);
            }),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshCalls += 1;
                return session("fresh-token", "refresh-2");
            }),
        );

        await expect(
            api.post(
                "/auth/login",
                { identifier: "ada", password: "wrong", client: "native" },
                { isAnonymous: true },
            ),
        ).rejects.toMatchObject({
            detail: "Invalid credentials.",
            status: 401,
        });

        // Replaying it would halve a 3-per-15-minutes budget, and the
        // background refresh would then report the session as expired — over
        // a mistyped password.
        expect(sent).toEqual([null]);
        expect(refreshCalls).toBe(0);
        expect(sessionExpired).not.toHaveBeenCalled();
    });

    it("does not sign out a reader who was never signed in", async () => {
        let refreshCalls = 0;

        server.use(
            http.get(`${BASE}/posts`, () => problem("Unauthorized.", 401)),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshCalls += 1;
                return problem("Session not found", 401);
            }),
        );

        await expect(
            api.get("/posts", { isPublic: true }),
        ).rejects.toMatchObject({ status: 401 });

        expect(refreshCalls).toBe(0);
        expect(sessionExpired).not.toHaveBeenCalled();
    });

    it("retries a public read without the token and still returns content", async () => {
        await signIn();

        server.use(
            http.get(`${BASE}/posts`, ({ request }) =>
                request.headers.get("Authorization")
                    ? problem("Token expired.", 401)
                    : ok([{ id: "p1" }]),
            ),
            http.post(`${BASE}/auth/refresh`, () =>
                session("fresh-token", "refresh-2"),
            ),
        );

        await expect(api.get("/posts", { isPublic: true })).resolves.toEqual([
            { id: "p1" },
        ]);
    });
});

describe("reading the response", () => {
    it("keeps the cursor that get would discard", async () => {
        await signIn();
        server.use(
            http.get(`${BASE}/conversations`, () =>
                ok([{ id: "c1" }], {
                    timestamp: "2026-09-06T00:00:00.000Z",
                    nextCursor: "opaque-cursor",
                }),
            ),
        );

        const page = await api.getPage<{ id: string }[]>("/conversations");

        expect(page.data).toEqual([{ id: "c1" }]);
        expect(page.meta?.nextCursor).toBe("opaque-cursor");
    });

    it("turns an unreadable body into a problem document carrying the status", async () => {
        server.use(
            http.get(`${BASE}/posts`, () =>
                HttpResponse.html("<html>502 Bad Gateway</html>", {
                    status: 502,
                }),
            ),
        );

        // A bare SyntaxError has neither `status` nor `title`, so the status
        // never reaches the caller and the message can only be "something went
        // wrong".
        await expect(
            api.get("/posts", { isPublic: true }),
        ).rejects.toMatchObject({
            status: 502,
            type: "tdn:unreadable-response",
        });
    });

    it("answers a 204 with an empty object", async () => {
        await signIn();
        server.use(
            http.delete(
                `${BASE}/posts/p1`,
                () => new HttpResponse(null, { status: 204 }),
            ),
        );

        await expect(api.delete("/posts/p1")).resolves.toEqual({});
    });
});

describe("idempotency", () => {
    it("sends the key and reuses it on the replay after a refresh", async () => {
        await signIn();
        const keys: (string | null)[] = [];

        server.use(
            http.post(`${BASE}/posts`, ({ request }) => {
                keys.push(request.headers.get("Idempotency-Key"));
                return request.headers.get("Authorization") ===
                    "Bearer fresh-token"
                    ? ok({ id: "p1" })
                    : problem("Token expired.", 401);
            }),
            http.post(`${BASE}/auth/refresh`, () =>
                session("fresh-token", "refresh-2"),
            ),
        );

        await api.post(
            "/posts",
            { content: "hello" },
            { idempotencyKey: "key-1" },
        );

        // A key that changed between attempts would be the same as having
        // none: the second attempt would be treated as a new action and post
        // twice.
        expect(keys).toEqual(["key-1", "key-1"]);
    });

    it("sends no key when the caller supplies none", async () => {
        await signIn();
        let sentKey: string | null = "unset";

        server.use(
            http.post(`${BASE}/follows`, ({ request }) => {
                sentKey = request.headers.get("Idempotency-Key");
                return ok(null);
            }),
        );

        await api.post("/follows", { targetId: "u2" });
        expect(sentKey).toBeNull();
    });
});
