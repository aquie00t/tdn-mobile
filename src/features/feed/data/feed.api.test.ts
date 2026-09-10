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

describe("like and save", () => {
    /**
     * The four routes are not symmetric — the verb changes and so does the
     * last path segment. `DELETE /posts/:id/like` is a 404, which an
     * optimistic caller shows as a heart that fills and empties again with no
     * explanation, so the exact shapes are pinned here.
     */
    it.each([
        ["likePost", "POST", "/posts/p1/like"],
        ["unlikePost", "DELETE", "/posts/p1/unlike"],
        ["savePost", "POST", "/posts/p1/save"],
        ["unsavePost", "DELETE", "/posts/p1/unsave"],
    ])("%s is %s %s", async (name, method, path) => {
        let seen: { method: string; path: string } | null = null;

        const record = ({ request }: { request: Request }) => {
            seen = {
                method: request.method,
                path: new URL(request.url).pathname,
            };
            return new HttpResponse(null, { status: 204 });
        };

        server.use(
            http.post(`${BASE}${path}`, record),
            http.delete(`${BASE}${path}`, record),
        );

        const call = feedApi[name as keyof typeof feedApi] as (
            id: string,
        ) => Promise<void>;
        await call("p1");

        expect(seen).toEqual({
            method,
            path: `${new URL(BASE).pathname}${path}`,
        });
    });

    it("sends the reader's token, because none of these is public", async () => {
        // A like is an act, not a read. Flagged public it would be replayed
        // anonymously on a stale token and silently do nothing.
        await setTokens({ accessToken: "fresh" });
        let auth: string | null = null;

        server.use(
            http.post(`${BASE}/posts/p1/like`, ({ request }) => {
                auth = request.headers.get("Authorization");
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await feedApi.likePost("p1");

        expect(auth).toBe("Bearer fresh");
    });
});

describe("createPost", () => {
    it("carries the caller's idempotency key", async () => {
        await setTokens({ accessToken: "fresh" });
        let key: string | null = null;

        server.use(
            http.post(`${BASE}/posts`, ({ request }) => {
                key = request.headers.get("Idempotency-Key");
                return ok({ id: "p1" });
            }),
        );

        await feedApi.createPost("hello", "COMMUNITY", [], "key-1");

        // The widest window in the composer: the media has uploaded and the
        // create times out. Under the same key the API answers from the first
        // attempt rather than writing a second post.
        expect(key).toBe("key-1");
    });

    it("omits quotedPostId entirely on an ordinary post", async () => {
        await setTokens({ accessToken: "fresh" });
        let body: Record<string, unknown> = {};

        server.use(
            http.post(`${BASE}/posts`, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return ok({ id: "p1" });
            }),
        );

        await feedApi.createPost("hello", "COMMUNITY", ["u1"], "key-1");

        // Absent, not `null`. The server allows empty content only on a quote,
        // and a key that is present but empty is what trips that rule.
        expect("quotedPostId" in body).toBe(false);
        expect(body).toEqual({
            content: "hello",
            type: "COMMUNITY",
            mediaUrls: ["u1"],
        });
    });
});

describe("uploadMedia", () => {
    it("lets the runtime write the multipart boundary", async () => {
        await setTokens({ accessToken: "fresh" });
        let contentType: string | null = null;

        server.use(
            http.post(`${BASE}/media`, ({ request }) => {
                contentType = request.headers.get("Content-Type");
                return ok({ mediaUrls: ["u1"] });
            }),
        );

        const form = new FormData();
        form.append("files", "x");
        await feedApi.uploadMedia(form);

        // `contentType: false` on the client. Setting the header ourselves
        // would write `multipart/form-data` with no boundary, and the server
        // would fail to parse a body it was handed correctly.
        expect(contentType).toContain("multipart/form-data");
        expect(contentType).toContain("boundary=");
    });
});
