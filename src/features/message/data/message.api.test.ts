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
import type { Conversation, Message } from "./message.types";
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

const message = (over: Partial<Message> = {}): Message => ({
    id: "m1",
    conversationId: "c1",
    senderId: "u1",
    content: "hello",
    mediaUrls: [],
    isSensitive: false,
    mediaPending: false,
    mediaRejected: false,
    isDeleted: false,
    isMine: true,
    createdAt: "2026-09-10T12:00:00.000Z",
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

describe("getThread", () => {
    it("carries the conversation on the first page, so opening one costs a request", async () => {
        server.use(
            http.get(`${BASE}/conversations/c1/messages`, () =>
                page(
                    {
                        conversation: conversation(),
                        messages: [message()],
                    },
                    "older",
                ),
            ),
        );

        const result = await messageApi.getThread("c1");

        expect(result.data.conversation.id).toBe("c1");
        expect(result.data.messages).toHaveLength(1);
        expect(result.meta?.nextCursor).toBe("older");
    });

    it("asks for the thread default and pages backwards with the cursor", async () => {
        let url = "";
        server.use(
            http.get(`${BASE}/conversations/c1/messages`, ({ request }) => {
                url = request.url;
                return page({ conversation: conversation(), messages: [] });
            }),
        );

        await messageApi.getThread("c1", { cursor: "older" });

        expect(url).toContain("limit=30");
        expect(url).toContain("cursor=older");
    });

    it("throws the 404 a thread the caller is not in answers with", async () => {
        // 404 rather than 403, so membership cannot be probed — and a thread
        // hidden by a block answers the same way, for the same reason.
        server.use(
            http.get(`${BASE}/conversations/c1/messages`, () =>
                HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "ConversationNotFoundError",
                        status: 404,
                        detail: "Conversation not found.",
                        instance: "/api/v1/conversations/c1/messages",
                    },
                    { status: 404 },
                ),
            ),
        );

        await expect(messageApi.getThread("c1")).rejects.toMatchObject({
            status: 404,
        });
    });
});

describe("sendMessage", () => {
    it("sends the caller's idempotency key", async () => {
        // The whole reason the key is the caller's: a person tapping send
        // again after a timeout must be answered from the first attempt.
        let key: string | null = null;
        server.use(
            http.post(`${BASE}/conversations/c1/messages`, ({ request }) => {
                key = request.headers.get("Idempotency-Key");
                return ok(message());
            }),
        );

        await messageApi.sendMessage("c1", "hello", "key-1");

        expect(key).toBe("key-1");
    });

    it("returns the server's copy of the message", async () => {
        server.use(
            http.post(`${BASE}/conversations/c1/messages`, () =>
                ok(message({ id: "m9" })),
            ),
        );

        await expect(
            messageApi.sendMessage("c1", "hello", "key-1"),
        ).resolves.toMatchObject({ id: "m9" });
    });

    it("throws the refusal a thread that cannot be written to answers with", async () => {
        server.use(
            http.post(`${BASE}/conversations/c1/messages`, () =>
                HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "MessageNotSendableError",
                        status: 403,
                        detail: "You cannot send messages in this conversation.",
                        instance: "/api/v1/conversations/c1/messages",
                    },
                    { status: 403 },
                ),
            ),
        );

        await expect(
            messageApi.sendMessage("c1", "hello", "key-1"),
        ).rejects.toMatchObject({ title: "MessageNotSendableError" });
    });
});

describe("markRead and deleteMessage", () => {
    it("takes the 204 both answer with", async () => {
        // `apiClient` turns an empty body into `{}` rather than letting it
        // escape as a `SyntaxError`.
        server.use(
            http.patch(
                `${BASE}/conversations/c1/read`,
                () => new HttpResponse(null, { status: 204 }),
            ),
            http.delete(
                `${BASE}/messages/m1`,
                () => new HttpResponse(null, { status: 204 }),
            ),
        );

        await expect(messageApi.markRead("c1")).resolves.toBeDefined();
        await expect(messageApi.deleteMessage("m1")).resolves.toBeDefined();
    });
});

describe("openConversation", () => {
    it("returns the thread for the pair, whether it is new or not", async () => {
        // Idempotent: the same two accounts always resolve to the same
        // thread, so this is "open" rather than "create".
        server.use(
            http.post(`${BASE}/conversations`, () =>
                ok(conversation({ status: "PENDING", isRequest: false })),
            ),
        );

        const result = await messageApi.openConversation("u2");

        expect(result.id).toBe("c1");
        expect(result.status).toBe("PENDING");
    });

    it("throws the one error four different refusals share", async () => {
        // Yourself, a bot, an account pending deletion, or a block in either
        // direction. The server writes which; nothing on the client improves
        // on that.
        server.use(
            http.post(`${BASE}/conversations`, () =>
                HttpResponse.json(
                    {
                        type: "about:blank",
                        title: "InvalidRecipientError",
                        status: 400,
                        detail: "You cannot message this account.",
                        instance: "/api/v1/conversations",
                    },
                    { status: 400 },
                ),
            ),
        );

        await expect(messageApi.openConversation("u2")).rejects.toMatchObject({
            title: "InvalidRecipientError",
        });
    });
});
