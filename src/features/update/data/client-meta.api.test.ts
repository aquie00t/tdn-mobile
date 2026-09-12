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
import { clientMetaApi } from "./client-meta.api";

const BASE = BASE_URL;

const meta = {
    minSupportedBuild: 0,
    latestBuild: 0,
    updateRequired: false,
    storeUrl: "",
};

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-13T00:00:00.000Z" },
    });

/** Records the one request this endpoint ever receives. */
function capture(body = meta) {
    const seen: { url: URL | null; auth: string | null } = {
        url: null,
        auth: null,
    };

    server.use(
        http.get(`${BASE}/meta/client`, ({ request }) => {
            seen.url = new URL(request.url);
            seen.auth = request.headers.get("Authorization");
            return ok(body);
        }),
    );

    return seen;
}

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    // A signed-in phone, which is the state this call is usually made from —
    // and the state in which sending a token would be the easy mistake.
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("getClientMeta", () => {
    it("tells the API which build is asking", async () => {
        const seen = capture();

        await clientMetaApi.getClientMeta(7);

        expect(seen.url?.searchParams.get("build")).toBe("7");
    });

    it("omits the build entirely when this binary carries none", async () => {
        /*
         * Not `build=0`. The API answers `updateRequired: false` to a client
         * that did not say which build it is, and compares a nought against
         * the floor like any other number — so the tidy-looking default is the
         * one that locks the app out of itself.
         */
        const seen = capture();

        await clientMetaApi.getClientMeta(undefined);

        expect(seen.url?.searchParams.has("build")).toBe(false);
    });

    it("sends no token, even with a session in the keystore", async () => {
        /*
         * `isAnonymous` rather than `isPublic`. The endpoint authenticates
         * nobody, and the flag that matters is the one that keeps a 401 from
         * being replayed and refreshed — which, on a call made during boot,
         * would report the session as expired over something that has nothing
         * to do with it.
         */
        const seen = capture();

        await clientMetaApi.getClientMeta(1);

        expect(seen.auth).toBeNull();
    });

    it("reads the server's verdict out of the envelope", async () => {
        // The comparison belongs to the server; this is the whole of the
        // client's side of it.
        capture({
            minSupportedBuild: 12,
            latestBuild: 14,
            updateRequired: true,
            storeUrl:
                "https://play.google.com/store/apps/details?id=net.developernetwork.tdn",
        });

        await expect(clientMetaApi.getClientMeta(3)).resolves.toEqual({
            minSupportedBuild: 12,
            latestBuild: 14,
            updateRequired: true,
            storeUrl:
                "https://play.google.com/store/apps/details?id=net.developernetwork.tdn",
        });
    });
});
