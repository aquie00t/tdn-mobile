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
import { BOT_LIST_MAX_LIMIT, botApi } from "./bot.api";
import { clearTokens, setTokens } from "@core/session/tokens";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: {
            timestamp: "2026-09-12T00:00:00.000Z",
            limit: 50,
            offset: 0,
            count: 0,
        },
    });

/** Records the query of one `GET /profiles/bots`. */
function captureQuery() {
    const captured: { params: URLSearchParams; auth: string | null } = {
        params: new URLSearchParams(),
        auth: null,
    };

    server.use(
        http.get(`${BASE}/profiles/bots`, ({ request }) => {
            captured.params = new URL(request.url).searchParams;
            captured.auth = request.headers.get("Authorization");
            return ok([]);
        }),
    );

    return captured;
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

describe("getBots", () => {
    it("joins several fields into one request", async () => {
        // A bot matches on *any* of them, so one request answers all three.
        // One request per field would fetch the same bots repeatedly.
        const captured = captureQuery();

        await botApi.getBots({ categories: ["FRONTEND", "AI", "MOBILE"] });

        expect(captured.params.get("categories")).toBe("FRONTEND,AI,MOBILE");
    });

    it("omits the parameter entirely when no field was picked", async () => {
        // Not the same request as an empty value: no `categories` means every
        // categorised bot, which is what a reader with no field should see.
        const captured = captureQuery();

        await botApi.getBots({ categories: [] });

        expect(captured.params.has("categories")).toBe(false);
    });

    it("clamps the limit the schema would reject", async () => {
        // The endpoint answers an out-of-range limit with a 400, and a list
        // that renders an error instead of accounts is worse than a short one.
        const captured = captureQuery();

        await botApi.getBots({ limit: 500 });

        expect(captured.params.get("limit")).toBe(String(BOT_LIST_MAX_LIMIT));
    });

    it("pages by offset", async () => {
        const captured = captureQuery();

        await botApi.getBots({ offset: 50 });

        expect(captured.params.get("offset")).toBe("50");
    });

    it("carries the reader's token", async () => {
        /*
         * The whole reason this read is not `isPublic`. Auth is optional on
         * the endpoint, but the token is what fills `isFollowing` — without it
         * every bot comes back `false` and a returning account is handed its
         * own follows back as fresh suggestions.
         */
        const captured = captureQuery();

        await botApi.getBots();

        expect(captured.auth).toBe("Bearer fresh");
    });
});
