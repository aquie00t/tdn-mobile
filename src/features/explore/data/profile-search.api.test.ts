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
import {
    PROFILE_SEARCH_LIMIT,
    PROFILE_SEARCH_MAX_LIMIT,
    profileSearchApi,
} from "./profile-search.api";
import { clearTokens, setTokens } from "@core/session/tokens";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-13T00:00:00.000Z", count: 0 },
    });

function capture() {
    const seen: { params: URLSearchParams; auth: string | null } = {
        params: new URLSearchParams(),
        auth: null,
    };

    server.use(
        http.get(`${BASE}/profiles/search`, ({ request }) => {
            seen.params = new URL(request.url).searchParams;
            seen.auth = request.headers.get("Authorization");
            return ok([]);
        }),
    );

    return seen;
}

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("searchProfiles", () => {
    it("sends the query and a default limit", async () => {
        const seen = capture();

        await profileSearchApi.searchProfiles("ada");

        expect(seen.params.get("q")).toBe("ada");
        expect(seen.params.get("limit")).toBe(String(PROFILE_SEARCH_LIMIT));
    });

    it("clamps a limit the schema would reject", async () => {
        const seen = capture();

        await profileSearchApi.searchProfiles("ada", 500);

        expect(seen.params.get("limit")).toBe(String(PROFILE_SEARCH_MAX_LIMIT));
    });

    it("carries the reader's token", async () => {
        /*
         * `isPublic`, so a token goes when there is one. It is not decoration
         * here: the endpoint authenticates optionally and re-reads the account
         * row, which is how a suspended or deleted account stops being treated
         * as signed in — and the results carry `isMe` and `isFollowing`, which
         * mean nothing without it.
         */
        const seen = capture();

        await profileSearchApi.searchProfiles("ada");

        expect(seen.auth).toBe("Bearer fresh");
    });

    it("hands back the accounts the endpoint answered with", async () => {
        server.use(
            http.get(`${BASE}/profiles/search`, () =>
                ok([
                    {
                        id: "u1",
                        username: "ada",
                        fullName: "Ada Lovelace",
                        avatarUrl: "",
                    },
                ]),
            ),
        );

        const found = await profileSearchApi.searchProfiles("ada");

        // `id`, not `userId` — the field the two have already been mixed up on
        // once, on the value a follow request is built from.
        expect(found[0]?.id).toBe("u1");
    });
});
