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
import { followApi } from "./follow.api";

const BASE = BASE_URL;

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("follow and unfollow", () => {
    it("names the target in the body", async () => {
        let body: unknown = null;

        server.use(
            http.post(`${BASE}/follows`, async ({ request }) => {
                body = await request.json();
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await followApi.follow("u1");

        expect(body).toEqual({ targetId: "u1" });
    });

    it("sends a DELETE that carries a body and says what it is", async () => {
        /*
         * The unusual one: the account to unfollow is in the payload rather
         * than the path. `api.delete` serialises nothing of its own, so the
         * header has to be set by hand — without it the server receives a body
         * it will not parse and answers 400, which an optimistic caller shows
         * as a button that un-presses itself a moment later.
         */
        let body: unknown = null;
        let contentType: string | null = null;

        server.use(
            http.delete(`${BASE}/follows`, async ({ request }) => {
                contentType = request.headers.get("Content-Type");
                body = await request.json();
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await followApi.unfollow("u1");

        expect(body).toEqual({ targetId: "u1" });
        expect(contentType).toContain("application/json");
    });
});
