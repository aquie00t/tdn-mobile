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
import { clearTokens, setTokens } from "@core/session/tokens";
import { feedApi } from "./feed.api";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-10T00:00:00.000Z" },
    });

/** Captures the query of the request the handler saw. */
function capturing(): {
    seen: () => URLSearchParams;
    headers: () => Headers;
    handler: ReturnType<typeof http.get>;
} {
    let query = new URLSearchParams();
    let headers = new Headers();

    return {
        seen: () => query,
        headers: () => headers,
        handler: http.get(`${BASE}/posts`, ({ request }) => {
            const url = new URL(request.url);
            query = url.searchParams;
            headers = request.headers;
            return ok([]);
        }),
    };
}

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("getPosts", () => {
    it("asks for the first page by default", async () => {
        const spy = capturing();
        server.use(spy.handler);

        await feedApi.getPosts();

        expect(spy.seen().get("page")).toBe("1");
        expect(spy.seen().get("limit")).toBe("20");
    });

    it("carries whatever narrows the feed", async () => {
        const spy = capturing();
        server.use(spy.handler);

        await feedApi.getPosts({
            page: 3,
            type: "TECH_NEWS",
            tag: "expo",
            categories: ["AI", "MOBILE"],
        });

        expect(spy.seen().get("page")).toBe("3");
        expect(spy.seen().get("type")).toBe("TECH_NEWS");
        expect(spy.seen().get("tag")).toBe("expo");
        // Repeated, not joined. `categories=AI,MOBILE` is one category that
        // does not exist, and the API would answer an empty feed.
        expect(spy.seen().getAll("categories")).toEqual(["AI", "MOBILE"]);
    });

    it("leaves followedOnly out when it is false", async () => {
        const spy = capturing();
        server.use(spy.handler);

        await feedApi.getPosts({ followedOnly: false, categories: [] });

        // Absent rather than "false": the API reads a present value as a
        // value, and this flag also decides whether the request is public.
        expect(spy.seen().has("followedOnly")).toBe(false);
        expect(spy.seen().has("categories")).toBe(false);
    });

    it("names followedOnly when it is true", async () => {
        const spy = capturing();
        server.use(spy.handler);

        await feedApi.getPosts({ followedOnly: true });

        expect(spy.seen().get("followedOnly")).toBe("true");
    });

    it("unwraps the envelope", async () => {
        const post = { id: "p1", content: "hello" };
        server.use(http.get(`${BASE}/posts`, () => ok([post])));

        await expect(feedApi.getPosts()).resolves.toEqual([post]);
    });

    it("still answers a stale session, because the feed is public", async () => {
        // The point of `isPublic` on this client, which has no guest browsing:
        // a token that has expired must not turn a readable feed into an empty
        // screen. The request is replayed without the header and a refresh
        // runs behind it.
        await setTokens({ accessToken: "stale", refreshToken: "old" });
        const sent: (string | null)[] = [];
        let refreshCalls = 0;

        server.use(
            http.get(`${BASE}/posts`, ({ request }) => {
                const auth = request.headers.get("Authorization");
                sent.push(auth);

                if (auth) {
                    return HttpResponse.json(
                        {
                            type: "about:blank",
                            title: "UnauthorizedError",
                            status: 401,
                            detail: "Token expired",
                            instance: "/",
                        },
                        { status: 401 },
                    );
                }

                return ok([{ id: "p1" }]);
            }),
            http.post(`${BASE}/auth/refresh`, () => {
                refreshCalls += 1;
                return ok({
                    accessToken: "fresh",
                    expiresAt: 1,
                    refreshToken: "rotated",
                    refreshTokenExpiresAt: 2,
                    user: { id: "u1", username: "ada" },
                });
            }),
        );

        await expect(feedApi.getPosts()).resolves.toEqual([{ id: "p1" }]);

        // Once with the stale token, once without it.
        expect(sent).toEqual(["Bearer stale", null]);
        expect(refreshCalls).toBe(1);
    });
});

describe("getPostById", () => {
    it("reads one post and unwraps it", async () => {
        const post = { id: "p1", content: "hello", mediaPending: false };
        server.use(http.get(`${BASE}/posts/p1`, () => ok(post)));

        await expect(feedApi.getPostById("p1")).resolves.toEqual(post);
    });

    it("survives a stale session", async () => {
        // Polled while a video is checked, which can easily outlive an access
        // token. `isPublic` is what stops the wait ending in a sign-out.
        await setTokens({ accessToken: "stale", refreshToken: "old" });
        const sent: (string | null)[] = [];

        server.use(
            http.get(`${BASE}/posts/p1`, ({ request }) => {
                const auth = request.headers.get("Authorization");
                sent.push(auth);

                if (auth) {
                    return HttpResponse.json(
                        {
                            type: "about:blank",
                            title: "UnauthorizedError",
                            status: 401,
                            detail: "Token expired",
                            instance: "/",
                        },
                        { status: 401 },
                    );
                }

                return ok({ id: "p1" });
            }),
            http.post(`${BASE}/auth/refresh`, () =>
                ok({
                    accessToken: "fresh",
                    expiresAt: 1,
                    refreshToken: "rotated",
                    refreshTokenExpiresAt: 2,
                    user: { id: "u1", username: "ada" },
                }),
            ),
        );

        await expect(feedApi.getPostById("p1")).resolves.toEqual({ id: "p1" });
        expect(sent).toEqual(["Bearer stale", null]);
    });
});
