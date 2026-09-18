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

import { BASE_URL, IDEMPOTENCY_HEADER } from "@core/api/client";
import { EMPTY_DRAFT } from "../domain/draft";
import type { ArticleDraft } from "../domain/draft";
import {
    createArticleSender,
    toCreateBody,
    toUpdateBody,
} from "./article-save";
import { clearTokens, setTokens } from "@core/session/tokens";

const BASE = BASE_URL;

const ok = <T>(data: T) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-18T00:00:00.000Z" },
    });

const problem = (status: number, title: string) =>
    HttpResponse.json(
        {
            type: "about:blank",
            title,
            status,
            detail: title,
            instance: "/api/v1/articles",
        },
        { status },
    );

const draftWith = (changes: Partial<ArticleDraft>): ArticleDraft => ({
    ...EMPTY_DRAFT,
    title: "First",
    body: "Body",
    ...changes,
});

const asset = { uri: "file:///cover.jpg", mimeType: "image/jpeg" };

beforeEach(async () => {
    keystore.clear();
    await clearTokens();
    await setTokens({ accessToken: "fresh" });
});

afterEach(() => {
    server.events.removeAllListeners();
    vi.restoreAllMocks();
});

describe("toCreateBody", () => {
    it("leaves empty optional fields out rather than sending blanks", () => {
        const body = toCreateBody(
            draftWith({ title: "  Padded  " }),
            undefined,
        );

        expect(body).toEqual({
            title: "Padded",
            body: "Body",
            tags: [],
            categories: [],
        });
    });

    it("carries the cover's key", () => {
        const body = toCreateBody(draftWith({ coverAlt: "A cat" }), {
            asset,
            key: "covers/k1",
        });

        expect(body.coverImageKey).toBe("covers/k1");
        expect(body.coverImageAlt).toBe("A cat");
    });
});

describe("toUpdateBody", () => {
    it("sends an emptied excerpt as null, which erases it", () => {
        const body = toUpdateBody(draftWith({ excerpt: "  " }), undefined);

        expect(body.excerpt).toBeNull();
        expect(body.coverImageAlt).toBeNull();
    });

    it("tells leaving the cover alone apart from erasing it", () => {
        // Omitted is "leave it"; `null` is "take it off". Collapsing the two
        // would make removing a cover impossible.
        expect(toUpdateBody(draftWith({}), undefined)).not.toHaveProperty(
            "coverImageKey",
        );
        expect(toUpdateBody(draftWith({}), null).coverImageKey).toBeNull();
        expect(
            toUpdateBody(draftWith({}), { asset, key: "covers/k2" })
                .coverImageKey,
        ).toBe("covers/k2");
    });
});

describe("createArticleSender", () => {
    it("repeats a create in doubt as it was, under the same key", async () => {
        // The server fingerprints the body and answers 409 when a key comes
        // back with different text. By the retry the writer has typed on, so
        // the first attempt is what has to go again — not the screen.
        const seen: { key: string | null; title: string }[] = [];
        let calls = 0;
        server.use(
            http.post(`${BASE}/articles`, async ({ request }) => {
                const body = (await request.json()) as { title: string };
                seen.push({
                    key: request.headers.get(IDEMPOTENCY_HEADER),
                    title: body.title,
                });
                calls += 1;
                return calls === 1
                    ? problem(502, "BadGateway")
                    : ok({ id: "a1", slug: "first", title: body.title });
            }),
        );

        let n = 0;
        const sender = createArticleSender(() => `key-${++n}`);

        await expect(
            sender.send(draftWith({ title: "First" }), undefined),
        ).rejects.toMatchObject({ status: 502 });
        expect(sender.isHolding()).toBe(true);

        const result = await sender.send(
            draftWith({ title: "First, then more" }),
            undefined,
        );

        expect(seen).toEqual([
            { key: "key-1", title: "First" },
            { key: "key-1", title: "First" },
        ]);
        // What was sent is reported, so the editor knows the newer text is
        // still owed as an update.
        expect(result.sent.draft.title).toBe("First");
        expect(sender.isHolding()).toBe(false);
    });

    it("holds the attempt through a dropped connection", async () => {
        server.use(http.post(`${BASE}/articles`, () => HttpResponse.error()));

        const sender = createArticleSender(() => "key-1");

        await expect(
            sender.send(draftWith({}), undefined),
        ).rejects.toBeInstanceOf(Error);
        expect(sender.isHolding()).toBe(true);
    });

    it("holds it through a 409 for a first attempt still running", async () => {
        server.use(
            http.post(`${BASE}/articles`, () =>
                problem(409, "IdempotencyConflictError"),
            ),
        );

        const sender = createArticleSender(() => "key-1");

        await expect(
            sender.send(draftWith({}), undefined),
        ).rejects.toMatchObject({ status: 409 });
        expect(sender.isHolding()).toBe(true);
    });

    it("lets go after a refusal, so the next attempt carries the new text", async () => {
        // A 4xx means nothing was created, and the plugin does not remember a
        // failure — so the next attempt is a fresh one.
        const seen: { key: string | null; title: string }[] = [];
        let calls = 0;
        server.use(
            http.post(`${BASE}/articles`, async ({ request }) => {
                const body = (await request.json()) as { title: string };
                seen.push({
                    key: request.headers.get(IDEMPOTENCY_HEADER),
                    title: body.title,
                });
                calls += 1;
                return calls === 1
                    ? problem(429, "TooManyRequestsError")
                    : ok({ id: "a1", slug: "second", title: body.title });
            }),
        );

        let n = 0;
        const sender = createArticleSender(() => `key-${++n}`);

        await expect(
            sender.send(draftWith({ title: "First" }), undefined),
        ).rejects.toMatchObject({ status: 429 });
        expect(sender.isHolding()).toBe(false);

        await sender.send(draftWith({ title: "Second" }), undefined);

        expect(seen).toEqual([
            { key: "key-1", title: "First" },
            { key: "key-2", title: "Second" },
        ]);
    });
});
