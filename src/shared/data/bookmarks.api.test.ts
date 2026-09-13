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
import {
    BOOKMARKS_MAX_LIMIT,
    BOOKMARKS_PAGE_SIZE,
    bookmarksApi,
} from "./bookmarks.api";
import { clearTokens, setTokens } from "@core/session/tokens";

const BASE = BASE_URL;

/** The two kinds this app draws, as far as these tests care. */
interface TestPost {
    id: string;
}
interface TestComment {
    id: string;
}

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: {
            timestamp: "2026-09-13T00:00:00.000Z",
            postTotal: 0,
            commentTotal: 0,
            articleTotal: 0,
            page: 1,
        },
    });

function capture(body: unknown = { posts: [], comments: [], articles: [] }): {
    params: URLSearchParams;
    auth: string | null;
} {
    const seen: { params: URLSearchParams; auth: string | null } = {
        params: new URLSearchParams(),
        auth: null,
    };

    server.use(
        http.get(`${BASE}/posts/bookmarks`, ({ request }) => {
            seen.params = new URL(request.url).searchParams;
            seen.auth = request.headers.get("Authorization");
            return ok(body);
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

describe("getBookmarks", () => {
    it("asks for the first page by default", async () => {
        const seen = capture();

        await bookmarksApi.getBookmarks<TestPost, TestComment>();

        expect(seen.params.get("page")).toBe("1");
        expect(seen.params.get("limit")).toBe(String(BOOKMARKS_PAGE_SIZE));
    });

    it("pages by number", async () => {
        const seen = capture();

        await bookmarksApi.getBookmarks<TestPost, TestComment>({ page: 3 });

        expect(seen.params.get("page")).toBe("3");
    });

    it("clamps a limit the schema would reject", async () => {
        // The endpoint answers an over-large limit with a 400, and a list that
        // renders an error instead of what somebody saved is worse than a
        // shorter page.
        const seen = capture();

        await bookmarksApi.getBookmarks<TestPost, TestComment>({ limit: 500 });

        expect(seen.params.get("limit")).toBe(String(BOOKMARKS_MAX_LIMIT));
    });

    it("carries the reader's token", async () => {
        // Not `isPublic`: a saved list is nobody's but its owner's, and the
        // endpoint authenticates.
        const seen = capture();

        await bookmarksApi.getBookmarks<TestPost, TestComment>();

        expect(seen.auth).toBe("Bearer fresh");
    });

    it("hands back all three lists from one document", async () => {
        capture({
            posts: [{ id: "p1" }],
            comments: [{ id: "c1" }, { id: "c2" }],
            articles: [{ id: "a1" }],
        });

        const page = await bookmarksApi.getBookmarks<TestPost, TestComment>();

        expect(page.posts).toHaveLength(1);
        expect(page.comments).toHaveLength(2);
        expect(page.articles).toHaveLength(1);
    });

    it("survives a server that answers without articles at all", async () => {
        /*
         * `articles` arrived in a later API version than the other two, so an
         * older server omits the field rather than sending an empty array.
         * Typed optional here, and the caller reads `?? []` — the web's hook
         * carries the same note.
         */
        capture({ posts: [{ id: "p1" }], comments: [] });

        const page = await bookmarksApi.getBookmarks<TestPost, TestComment>();

        expect(page.articles).toBeUndefined();
        expect(page.posts).toHaveLength(1);
    });
});
