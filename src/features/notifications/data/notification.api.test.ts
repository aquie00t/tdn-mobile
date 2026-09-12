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
import { notificationApi } from "./notification.api";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-10T00:00:00.000Z" },
    });

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("getUnreadCount", () => {
    it("unwraps the count out of its envelope", async () => {
        // `apiClient` unwraps `data`, so what arrives here is `{ count }` — the
        // caller wants the number, and the badge reading `[object Object]` is
        // the failure this prevents.
        server.use(
            http.get(`${BASE}/notifications/unread-count`, () =>
                ok({ count: 35 }),
            ),
        );

        await expect(notificationApi.getUnreadCount()).resolves.toBe(35);
    });

    it("carries the reader's token", async () => {
        // Not `isPublic`: a notification count is nobody's but the reader's,
        // so a request without a token has no meaning here.
        let auth: string | null = null;

        server.use(
            http.get(`${BASE}/notifications/unread-count`, ({ request }) => {
                auth = request.headers.get("Authorization");
                return ok({ count: 0 });
            }),
        );

        await notificationApi.getUnreadCount();

        expect(auth).toBe("Bearer fresh");
    });
});

describe("getNotifications", () => {
    it("pages from one by default", async () => {
        let query = new URLSearchParams();

        server.use(
            http.get(`${BASE}/notifications`, ({ request }) => {
                query = new URL(request.url).searchParams;
                return ok([]);
            }),
        );

        await notificationApi.getNotifications();

        expect(query.get("page")).toBe("1");
        expect(query.get("limit")).toBe("20");
    });
});

describe("markAllRead", () => {
    it("patches the read-all route", async () => {
        let method: string | null = null;

        server.use(
            http.patch(`${BASE}/notifications/read-all`, ({ request }) => {
                method = request.method;
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await notificationApi.markAllRead();

        expect(method).toBe("PATCH");
    });
});
