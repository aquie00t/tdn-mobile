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
import { commentApi } from "./comment.api";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-10T00:00:00.000Z" },
    });

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("collection paths", () => {
    it.each([
        ["post", "/posts/t1/comments"],
        ["article", "/articles/t1/comments"],
    ])("reads a %s's comments from %s", async (type, path) => {
        let seen: string | null = null;

        server.use(
            http.get(`${BASE}${path}`, ({ request }) => {
                seen = new URL(request.url).pathname;
                return ok([]);
            }),
        );

        await commentApi.getComments({
            type: type as "post" | "article",
            id: "t1",
        });

        expect(seen).toBe(`${new URL(BASE).pathname}${path}`);
    });

    it("reads replies from the shared per-comment route", async () => {
        // Only the two collection routes differ between posts and articles;
        // everything under `/comments/:id` is the same for both.
        let seen: string | null = null;

        server.use(
            http.get(`${BASE}/comments/c1/replies`, ({ request }) => {
                seen = new URL(request.url).pathname;
                return ok([]);
            }),
        );

        await commentApi.getReplies("c1");

        expect(seen).toBe(`${new URL(BASE).pathname}/comments/c1/replies`);
    });

    it("pages from one by default", async () => {
        let query = new URLSearchParams();

        server.use(
            http.get(`${BASE}/posts/t1/comments`, ({ request }) => {
                query = new URL(request.url).searchParams;
                return ok([]);
            }),
        );

        await commentApi.getComments({ type: "post", id: "t1" });

        expect(query.get("page")).toBe("1");
        expect(query.get("limit")).toBe("20");
    });
});

describe("createComment", () => {
    it("carries the caller's idempotency key", async () => {
        await setTokens({ accessToken: "fresh" });
        let key: string | null = null;

        server.use(
            http.post(`${BASE}/posts/t1/comments`, ({ request }) => {
                key = request.headers.get("Idempotency-Key");
                return ok({ id: "c1" });
            }),
        );

        await commentApi.createComment(
            { type: "post", id: "t1" },
            { content: "hello" },
            "key-1",
        );

        // Without it, a retry after a timeout posts the comment twice.
        expect(key).toBe("key-1");
    });

    it("omits parentId entirely on a top-level comment", async () => {
        await setTokens({ accessToken: "fresh" });
        let body: Record<string, unknown> = {};

        server.use(
            http.post(`${BASE}/posts/t1/comments`, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return ok({ id: "c1" });
            }),
        );

        await commentApi.createComment(
            { type: "post", id: "t1" },
            { content: "hello" },
            "key-1",
        );

        // Absent, not `null`. A present key is an intent, and "a reply to
        // nothing" is a different request from "not a reply".
        expect("parentId" in body).toBe(false);
        expect(body).toEqual({ content: "hello", mediaUrls: [] });
    });

    it("sends parentId on a reply", async () => {
        await setTokens({ accessToken: "fresh" });
        let body: Record<string, unknown> = {};

        server.use(
            http.post(`${BASE}/posts/t1/comments`, async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;
                return ok({ id: "c2" });
            }),
        );

        await commentApi.createComment(
            { type: "post", id: "t1" },
            { content: "hi", parentId: "c1" },
            "key-2",
        );

        expect(body.parentId).toBe("c1");
    });
});

describe("like and save a comment", () => {
    /**
     * The same four asymmetric routes a post has — the verb changes and so
     * does the last path segment. `DELETE /comments/:id/like` is a 404, which
     * an optimistic caller renders as a heart that fills and empties again
     * with no explanation.
     */
    it.each([
        ["likeComment", "POST", "/comments/c1/like"],
        ["unlikeComment", "DELETE", "/comments/c1/unlike"],
        ["saveComment", "POST", "/comments/c1/save"],
        ["unsaveComment", "DELETE", "/comments/c1/unsave"],
    ])("%s is %s %s", async (name, method, path) => {
        await setTokens({ accessToken: "fresh" });
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

        const call = commentApi[name as keyof typeof commentApi] as (
            id: string,
        ) => Promise<void>;
        await call("c1");

        expect(seen).toEqual({
            method,
            path: `${new URL(BASE).pathname}${path}`,
        });
    });
});
