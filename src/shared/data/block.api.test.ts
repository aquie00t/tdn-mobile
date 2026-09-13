import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "../../../tests/msw-server";

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
import { BLOCKED_LIST_MAX_LIMIT, blockApi } from "./block.api";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-13T00:00:00.000Z" },
    });

const problem = (status: number, detail: string) =>
    HttpResponse.json(
        {
            type: "about:blank",
            title: status === 404 ? "Not Found" : "Bad Request",
            status,
            detail,
            instance: "/api/v1/blocks",
        },
        { status },
    );

interface Captured {
    body: unknown;
    contentType: string | null;
}

async function capture(request: Request): Promise<Captured> {
    const text = await request.text();
    return {
        body: text ? (JSON.parse(text) as unknown) : null,
        contentType: request.headers.get("Content-Type"),
    };
}

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
});

describe("block", () => {
    it("names the account in the body and unwraps the answer", async () => {
        let seen: Captured | null = null;
        server.use(
            http.post(`${BASE}/blocks`, async ({ request }) => {
                seen = await capture(request);
                return ok({ isBlocked: true });
            }),
        );

        await expect(blockApi.block("u2")).resolves.toEqual({
            isBlocked: true,
        });
        expect(seen).toEqual({
            body: { targetId: "u2" },
            contentType: "application/json",
        });
    });

    it("hands a refusal back as the API worded it", async () => {
        server.use(
            http.post(`${BASE}/blocks`, () =>
                problem(400, "You cannot block yourself."),
            ),
        );

        await expect(blockApi.block("me")).rejects.toEqual(
            expect.objectContaining({
                status: 400,
                detail: "You cannot block yourself.",
            }),
        );
    });
});

describe("unblock", () => {
    it("carries the account in the body of the DELETE", async () => {
        // The account is in the payload, not the path. Without the header
        // the server would not parse it and would answer 400.
        let seen: Captured | null = null;
        server.use(
            http.delete(`${BASE}/blocks`, async ({ request }) => {
                seen = await capture(request);
                return ok({ isBlocked: false });
            }),
        );

        await expect(blockApi.unblock("u2")).resolves.toEqual({
            isBlocked: false,
        });
        expect(seen).toEqual({
            body: { targetId: "u2" },
            contentType: "application/json",
        });
    });
});

describe("getBlocked", () => {
    function captureQuery() {
        const seen: { limit: string | null; offset: string | null }[] = [];
        server.use(
            http.get(`${BASE}/blocks`, ({ request }) => {
                const url = new URL(request.url);
                seen.push({
                    limit: url.searchParams.get("limit"),
                    offset: url.searchParams.get("offset"),
                });
                return ok([]);
            }),
        );
        return seen;
    }

    it("asks for the first page by default", async () => {
        const seen = captureQuery();

        await blockApi.getBlocked();

        expect(seen).toEqual([{ limit: "20", offset: "0" }]);
    });

    it("asks from wherever the caller has reached", async () => {
        const seen = captureQuery();

        await blockApi.getBlocked({ offset: 37 });

        expect(seen).toEqual([{ limit: "20", offset: "37" }]);
    });

    it("clamps the limit instead of sending one the schema refuses", async () => {
        const seen = captureQuery();

        await blockApi.getBlocked({ limit: 500 });
        await blockApi.getBlocked({ limit: 0 });

        expect(seen).toEqual([
            { limit: String(BLOCKED_LIST_MAX_LIMIT), offset: "0" },
            { limit: "1", offset: "0" },
        ]);
    });

    it("unwraps the rows", async () => {
        const rows = [
            {
                userId: "u2",
                username: "someone",
                fullName: "Some One",
                avatarUrl: "",
                bio: null,
            },
        ];
        server.use(http.get(`${BASE}/blocks`, () => ok(rows)));

        await expect(blockApi.getBlocked()).resolves.toEqual(rows);
    });
});
