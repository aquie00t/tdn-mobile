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
import type { Conversation } from "./message.types";
import { messageApi } from "./message.api";

const BASE = BASE_URL;

const conversation = (over: Partial<Conversation> = {}): Conversation => ({
    id: "c1",
    status: "ACCEPTED",
    isRequest: false,
    canSend: true,
    participant: {
        id: "u2",
        username: "ayse",
        avatarUrl: "https://cdn.example/a.jpg",
    },
    unreadCount: 0,
    lastMessagePreview: "hello",
    lastMessageAt: "2026-09-10T12:00:00.000Z",
    otherLastReadAt: null,
    createdAt: "2026-09-01T09:00:00.000Z",
    ...over,
});

const page = <T>(data: T, nextCursor: string | null = null) =>
    HttpResponse.json({
        data,
        meta: { timestamp: "2026-09-10T00:00:00.000Z", nextCursor },
    });

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

describe("getConversations", () => {
    it("keeps the whole envelope, because the cursor lives in it", async () => {
        // The one thing `api.get` would lose: it unwraps `data` and throws
        // `meta` away, and `meta.nextCursor` is the only way to ask for a
        // second page of a listing that has no page numbers.
        server.use(
            http.get(`${BASE}/conversations`, () =>
                page([conversation()], "opaque-cursor"),
            ),
        );

        const result = await messageApi.getConversations("ACCEPTED");

        expect(result.data).toHaveLength(1);
        expect(result.meta?.nextCursor).toBe("opaque-cursor");
    });

    it("asks for the status it was given, with the default limit", async () => {
        let url = "";
        server.use(
            http.get(`${BASE}/conversations`, ({ request }) => {
                url = request.url;
                return page([]);
            }),
        );

        await messageApi.getConversations("PENDING");

        expect(url).toContain("status=PENDING");
        expect(url).toContain("limit=20");
    });

    it("omits the cursor on a first page rather than sending an empty one", async () => {
        // An undecodable cursor is answered with the first page anyway — but
        // only because no client invents one. Sending `cursor=` is how that
        // stops being true.
        let url = "";
        server.use(
            http.get(`${BASE}/conversations`, ({ request }) => {
                url = request.url;
                return page([]);
            }),
        );

        await messageApi.getConversations("ACCEPTED", { cursor: null });

        expect(url).not.toContain("cursor");
    });

    it("echoes a cursor back verbatim", async () => {
        // Opaque: never parsed, never built. The `+` and `=` of a base64
        // cursor are exactly what a hand-built query string would mangle.
        const cursor = "eyJpZCI6ImMxIn0=";
        let received: string | null = null;

        server.use(
            http.get(`${BASE}/conversations`, ({ request }) => {
                received = new URL(request.url).searchParams.get("cursor");
                return page([]);
            }),
        );

        await messageApi.getConversations("ACCEPTED", { cursor });

        expect(received).toBe(cursor);
    });

    it("reports the end of a listing as a null cursor", async () => {
        server.use(
            http.get(`${BASE}/conversations`, () => page([conversation()])),
        );

        const result = await messageApi.getConversations("ACCEPTED");

        expect(result.meta?.nextCursor).toBeNull();
    });
});

describe("getUnreadCount", () => {
    it("unwraps the count out of its envelope", async () => {
        // `apiClient` unwraps `data`, so what arrives is `{ count }` — the
        // number is one level further in, and the badge wants the number.
        server.use(
            http.get(`${BASE}/conversations/unread-count`, () =>
                ok({ count: 3 }),
            ),
        );

        await expect(messageApi.getUnreadCount()).resolves.toBe(3);
    });
});

describe("accept and decline", () => {
    it("returns the conversation the accept produced", async () => {
        // Answered with the whole row rather than a status, which is why
        // neither write is optimistic: there is nothing to guess.
        server.use(
            http.patch(`${BASE}/conversations/c1/accept`, () =>
                ok(conversation({ status: "ACCEPTED", isRequest: false })),
            ),
        );

        const result = await messageApi.acceptConversation("c1");

        expect(result.status).toBe("ACCEPTED");
        expect(result.isRequest).toBe(false);
    });

    it("returns a declined conversation that can no longer be written to", async () => {
        server.use(
            http.patch(`${BASE}/conversations/c1/decline`, () =>
                ok(conversation({ status: "DECLINED", canSend: false })),
            ),
        );

        const result = await messageApi.declineConversation("c1");

        expect(result.status).toBe("DECLINED");
        expect(result.canSend).toBe(false);
    });

    it("throws the server's answer when a request is no longer sendable", async () => {
        // 403 `MessageNotSendableError`, which the row shows as the server
        // wrote it: a retry cannot fix it and the reader has to know that.
        server.use(
            http.patch(`${BASE}/conversations/c1/accept`, () =>
                HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "MessageNotSendableError",
                        status: 403,
                        detail: "You cannot send messages in this conversation.",
                        instance: "/api/v1/conversations/c1/accept",
                    },
                    { status: 403 },
                ),
            ),
        );

        await expect(messageApi.acceptConversation("c1")).rejects.toMatchObject(
            { title: "MessageNotSendableError", status: 403 },
        );
    });
});
