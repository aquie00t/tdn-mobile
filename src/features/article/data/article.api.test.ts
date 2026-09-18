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
import { articleApi } from "./article.api";
import { clearTokens, setTokens } from "@core/session/tokens";

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

describe("getArticles", () => {
    it("asks for a page rather than a cursor", async () => {
        // `page`/`limit`, so `api.get` rather than `api.getPage`: the listing
        // answers a bare array and keeps nothing in `meta` worth having.
        let url = "";
        server.use(
            http.get(`${BASE}/articles`, ({ request }) => {
                url = request.url;
                return ok([]);
            }),
        );

        await articleApi.getArticles();

        expect(url).toContain("page=1");
        expect(url).toContain("limit=20");
    });

    it("repeats the categories parameter rather than joining it", async () => {
        // The server reads repeated keys. Joined with a comma it sees one
        // category named "AI,MOBILE" and matches nothing.
        let values: string[] = [];
        server.use(
            http.get(`${BASE}/articles`, ({ request }) => {
                values = new URL(request.url).searchParams.getAll("categories");
                return ok([]);
            }),
        );

        await articleApi.getArticles({ categories: ["AI", "MOBILE"] });

        expect(values).toEqual(["AI", "MOBILE"]);
    });

    it("sends no token narrowing when nothing narrows it", async () => {
        let url = "";
        server.use(
            http.get(`${BASE}/articles`, ({ request }) => {
                url = request.url;
                return ok([]);
            }),
        );

        await articleApi.getArticles();

        expect(url).not.toContain("followedOnly");
        expect(url).not.toContain("tag=");
    });
});

describe("getArticleBySlug", () => {
    it("escapes a slug rather than pasting it into the path", async () => {
        let path = "";
        server.use(
            http.get(`${BASE}/articles/:slug`, ({ request }) => {
                path = new URL(request.url).pathname;
                return ok({ slug: "a b", body: "# hi" });
            }),
        );

        await articleApi.getArticleBySlug("a b");

        expect(path).toContain("a%20b");
    });

    it("throws the 404 an unpublished draft answers with", async () => {
        // A draft belonging to somebody else answers 404, not 403, so a
        // failure here is an ordinary not-found and never a "this exists but
        // you may not read it".
        server.use(
            http.get(`${BASE}/articles/:slug`, () =>
                HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "ArticleNotFoundError",
                        status: 404,
                        detail: "Article not found.",
                        instance: "/api/v1/articles/draft",
                    },
                    { status: 404 },
                ),
            ),
        );

        await expect(
            articleApi.getArticleBySlug("draft"),
        ).rejects.toMatchObject({ status: 404 });
    });
});

describe("the undo paths", () => {
    it("un-likes with DELETE on the like path, not an unlike path", async () => {
        // An article answers `DELETE /articles/:id/like`, where a post answers
        // `DELETE /posts/:id/unlike`. Copying the feed's call is a 404 on
        // every undo.
        let path = "";
        server.use(
            http.delete(`${BASE}/articles/a1/like`, ({ request }) => {
                path = new URL(request.url).pathname;
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await articleApi.unlikeArticle("a1");

        expect(path).toContain("/articles/a1/like");
    });

    it("un-bookmarks the same way", async () => {
        server.use(
            http.delete(
                `${BASE}/articles/a1/bookmark`,
                () => new HttpResponse(null, { status: 204 }),
            ),
        );

        await expect(articleApi.unbookmarkArticle("a1")).resolves.toBeDefined();
    });
});

describe("writing", () => {
    it("sends the caller's key with a create", async () => {
        let key: string | null = null;
        server.use(
            http.post(`${BASE}/articles`, ({ request }) => {
                key = request.headers.get("Idempotency-Key");
                return ok({ id: "a1", slug: "a", status: "DRAFT" });
            }),
        );

        await articleApi.createArticle({ title: "A", body: "B" }, "key-1");

        expect(key).toBe("key-1");
    });

    it("moves an article along by id, on its own paths", async () => {
        const paths: string[] = [];
        const prefix = new URL(BASE).pathname;
        const seen = (request: Request) =>
            `${request.method} ${new URL(request.url).pathname.slice(prefix.length)}`;
        const record = ({ request }: { request: Request }) => {
            paths.push(seen(request));
            return ok({ id: "a1", slug: "a", status: "PUBLISHED" });
        };
        server.use(
            http.patch(`${BASE}/articles/a1`, record),
            http.post(`${BASE}/articles/a1/publish`, record),
            http.post(`${BASE}/articles/a1/archive`, record),
            http.delete(`${BASE}/articles/a1`, ({ request }) => {
                paths.push(seen(request));
                return new HttpResponse(null, { status: 204 });
            }),
        );

        await articleApi.updateArticle("a1", { title: "B" });
        await articleApi.publishArticle("a1");
        await articleApi.archiveArticle("a1");
        await articleApi.deleteArticle("a1");

        expect(paths).toEqual([
            "PATCH /articles/a1",
            "POST /articles/a1/publish",
            "POST /articles/a1/archive",
            "DELETE /articles/a1",
        ]);
    });

    it("uploads a cover as multipart, to the cover channel", async () => {
        let contentType: string | null = null;
        server.use(
            http.post(`${BASE}/articles/cover`, ({ request }) => {
                contentType = request.headers.get("Content-Type");
                return ok({
                    coverImageKey: "covers/k1",
                    coverImageUrl: "https://cdn.test/k1.jpg",
                });
            }),
        );

        const { coverImageKey } = await articleApi.uploadCover({
            uri: "file:///cover.jpg",
            mimeType: "image/jpeg",
        });

        expect(coverImageKey).toBe("covers/k1");
        // Written by the runtime with its boundary, never by us.
        expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
    });
});

describe("getMyArticles", () => {
    it("reads the caller's own list, narrowed by status", async () => {
        let url = "";
        server.use(
            http.get(`${BASE}/articles/me`, ({ request }) => {
                url = request.url;
                return ok([]);
            }),
        );

        await articleApi.getMyArticles({ status: "DRAFT", page: 2 });

        const params = new URL(url).searchParams;
        expect(params.get("status")).toBe("DRAFT");
        expect(params.get("page")).toBe("2");
        expect(params.get("limit")).toBe("20");
    });

    it("sends no status when none is asked for", async () => {
        let url = "";
        server.use(
            http.get(`${BASE}/articles/me`, ({ request }) => {
                url = request.url;
                return ok([]);
            }),
        );

        await articleApi.getMyArticles();

        expect(new URL(url).searchParams.has("status")).toBe(false);
    });
});
