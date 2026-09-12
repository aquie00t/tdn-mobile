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
import { TAG_MAX_LIMIT, trendsApi } from "./trends.api";
import { clearTokens, setTokens } from "@core/session/tokens";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-13T00:00:00.000Z", windowDays: 7 },
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

describe("getTrends", () => {
    it("unwraps the list out of the object inside the envelope", async () => {
        /*
         * `data.trends`, not `data`. This endpoint is the one read in the app
         * that nests its list, and `apiClient` unwraps exactly one layer — so
         * the caller is handed `{ trends: [...] }` and a hook that treated it
         * as an array would render nothing with no error to explain it.
         */
        server.use(
            http.get(`${BASE}/tags/trends`, () =>
                ok({
                    trends: [
                        {
                            tag: "nodejs",
                            postCount: 12,
                            articleCount: 3,
                            category: "BACKEND",
                        },
                    ],
                }),
            ),
        );

        const data = await trendsApi.getTrends();

        expect(data.trends).toHaveLength(1);
        expect(data.trends[0]?.tag).toBe("nodejs");
    });

    it("carries a null category through rather than dropping it", async () => {
        // The schema is `Union([String, Null])` while the web's type says
        // `string`. A tile branches on it; a type that lies would not.
        server.use(
            http.get(`${BASE}/tags/trends`, () =>
                ok({
                    trends: [
                        {
                            tag: "misc",
                            postCount: 1,
                            articleCount: 0,
                            category: null,
                        },
                    ],
                }),
            ),
        );

        const data = await trendsApi.getTrends();

        expect(data.trends[0]?.category).toBeNull();
    });

    it("clamps a limit the schema would reject", async () => {
        let limit: string | null = null;

        server.use(
            http.get(`${BASE}/tags/trends`, ({ request }) => {
                limit = new URL(request.url).searchParams.get("limit");
                return ok({ trends: [] });
            }),
        );

        await trendsApi.getTrends(500);

        expect(limit).toBe(String(TAG_MAX_LIMIT));
    });
});

describe("searchTags", () => {
    it("encodes the query rather than pasting it into the URL", async () => {
        /*
         * The one place in this app where somebody's raw keystrokes become a
         * URL. A `#` typed in front of a tag — which is how people write them
         * — would otherwise truncate the request at the fragment and search
         * for an empty string.
         */
        let q: string | null = null;

        server.use(
            http.get(`${BASE}/tags/search`, ({ request }) => {
                q = new URL(request.url).searchParams.get("q");
                return ok([]);
            }),
        );

        await trendsApi.searchTags("#node js");

        expect(q).toBe("#node js");
    });

    it("returns the array the search answers with", async () => {
        server.use(
            http.get(`${BASE}/tags/search`, () =>
                ok([
                    {
                        name: "nodejs",
                        postCount: 12,
                        articleCount: 3,
                        category: null,
                    },
                ]),
            ),
        );

        await expect(trendsApi.searchTags("node")).resolves.toHaveLength(1);
    });
});
