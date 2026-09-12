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
import { deviceApi } from "./device.api";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-12T00:00:00.000Z" },
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

describe("register", () => {
    it("sends the token, the platform and the device's language", async () => {
        let body: unknown = null;

        server.use(
            http.post(`${BASE}/devices`, async ({ request }) => {
                body = await request.json();
                return ok({ registered: true });
            }),
        );

        await expect(
            deviceApi.register({
                token: "ExponentPushToken[abc]",
                platform: "ANDROID",
                appVersion: "1",
                locale: "tr",
            }),
        ).resolves.toEqual({ registered: true });

        expect(body).toEqual({
            token: "ExponentPushToken[abc]",
            platform: "ANDROID",
            appVersion: "1",
            locale: "tr",
        });
    });

    it("carries the owner's token", async () => {
        // Not `isPublic`: a device belongs to an account, and the API scopes
        // the row to whoever authenticated the request.
        let auth: string | null = null;

        server.use(
            http.post(`${BASE}/devices`, ({ request }) => {
                auth = request.headers.get("Authorization");
                return ok({ registered: true });
            }),
        );

        await deviceApi.register({ token: "t", platform: "ANDROID" });

        expect(auth).toBe("Bearer fresh");
    });
});

describe("unregister", () => {
    it("puts the token in the body of a DELETE, with a content type", async () => {
        /*
         * The header is the part worth asserting. `api.delete` serialises
         * nothing of its own, so it also writes no `Content-Type` — and
         * without one the server receives a body it will not parse and answers
         * 400, leaving the phone registered to an account that just signed
         * out.
         */
        let body: unknown = null;
        let contentType: string | null = null;

        server.use(
            http.delete(`${BASE}/devices`, async ({ request }) => {
                contentType = request.headers.get("Content-Type");
                body = await request.json();
                return ok({ registered: false });
            }),
        );

        await expect(
            deviceApi.unregister("ExponentPushToken[abc]"),
        ).resolves.toEqual({ registered: false });

        expect(contentType).toBe("application/json");
        expect(body).toEqual({ token: "ExponentPushToken[abc]" });
    });
});
