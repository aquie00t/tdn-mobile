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
import { FOLLOW_LIST_MAX_LIMIT, profileApi } from "./profile.api";

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

describe("getProfile", () => {
    it("reads a profile and unwraps it", async () => {
        const profile = { id: "u1", username: "ada" };
        server.use(http.get(`${BASE}/profiles/ada`, () => ok(profile)));

        await expect(profileApi.getProfile("ada")).resolves.toEqual(profile);
    });

    it("survives a stale session", async () => {
        // A profile is readable, so an expired token must show it rather than
        // an empty screen — the same rule the feed follows.
        const sent: (string | null)[] = [];

        server.use(
            http.get(`${BASE}/profiles/ada`, ({ request }) => {
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

                return ok({ id: "u1", username: "ada" });
            }),
            http.post(`${BASE}/auth/refresh`, () =>
                ok({
                    accessToken: "new",
                    expiresAt: 1,
                    refreshToken: "rotated",
                    refreshTokenExpiresAt: 2,
                    user: { id: "u1", username: "ada" },
                }),
            ),
        );

        await expect(profileApi.getProfile("ada")).resolves.toEqual({
            id: "u1",
            username: "ada",
        });
        expect(sent).toEqual(["Bearer fresh", null]);
    });
});

describe("follow lists", () => {
    it("pages by offset, with the server's own default size", async () => {
        let query = new URLSearchParams();

        server.use(
            http.get(`${BASE}/profiles/ada/followers`, ({ request }) => {
                query = new URL(request.url).searchParams;
                return ok([]);
            }),
        );

        await profileApi.getFollowers("ada");

        // Offset, not a page counter: the endpoint may answer a short page,
        // and a counter would then skip whatever sat between the two.
        expect(query.get("offset")).toBe("0");
        expect(query.get("limit")).toBe("20");
        expect(query.has("page")).toBe(false);
    });

    it("clamps a limit the schema would refuse", async () => {
        // Over the maximum the endpoint answers 400, and a list that renders
        // an error instead of people is worse than a shorter page.
        let query = new URLSearchParams();

        server.use(
            http.get(`${BASE}/profiles/ada/following`, ({ request }) => {
                query = new URL(request.url).searchParams;
                return ok([]);
            }),
        );

        await profileApi.getFollowing("ada", { limit: 500, offset: 40 });

        expect(query.get("limit")).toBe(String(FOLLOW_LIST_MAX_LIMIT));
        expect(query.get("offset")).toBe("40");
    });

    it("reads the two sides from their own routes", async () => {
        const seen: string[] = [];
        const record = ({ request }: { request: Request }) => {
            seen.push(new URL(request.url).pathname);
            return ok([]);
        };

        server.use(
            http.get(`${BASE}/profiles/ada/followers`, record),
            http.get(`${BASE}/profiles/ada/following`, record),
        );

        await profileApi.getFollowers("ada");
        await profileApi.getFollowing("ada");

        const prefix = new URL(BASE).pathname;
        expect(seen).toEqual([
            `${prefix}/profiles/ada/followers`,
            `${prefix}/profiles/ada/following`,
        ]);
    });
});
