import { beforeEach, describe, expect, it } from "vitest";

import type {
    Conversation,
    IncomingMessagePayload,
    Message,
} from "../../data/message.types";
import { useMessageStore } from "./message.store";

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

const incoming = (
    over: Partial<IncomingMessagePayload> = {},
): IncomingMessagePayload => ({
    conversationId: "c1",
    messageId: "m1",
    senderId: "u2",
    preview: "are you there",
    hasMedia: false,
    createdAt: "2026-09-10T13:00:00.000Z",
    ...over,
});

/** A `PENDING` row the reader has to answer. */
const request = (over: Partial<Conversation> = {}): Conversation =>
    conversation({ status: "PENDING", isRequest: true, ...over });

/** A `PENDING` row the reader opened, which the same listing also returns. */
const outgoing = (over: Partial<Conversation> = {}): Conversation =>
    conversation({ status: "PENDING", isRequest: false, ...over });

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

const state = () => useMessageStore.getState();

beforeEach(() => {
    state().reset();
    useMessageStore.setState({
        conversationsRevision: 0,
        requestsRevision: 0,
        threadRevision: 0,
    });
});

describe("setRequests", () => {
    it("settles the count from the first page", () => {
        state().setRequests([request({ id: "r1" })], null);

        expect(state().requestCount).toBe(1);
    });

    it("adds an appended page to it rather than replacing it", () => {
        state().setRequests([request({ id: "r1" })], "next");
        state().setRequests([request({ id: "r2" })], null, true);

        expect(state().requests).toHaveLength(2);
        expect(state().requestCount).toBe(2);
    });

    it("counts only the requests the reader has to answer", () => {
        // The listing filters on participation and status, never on who
        // opened the thread, so it carries the reader's own outgoing requests
        // too. Those are not decisions and must not put a number on the tab.
        state().setRequests(
            [request({ id: "r1" }), outgoing({ id: "r2" })],
            null,
        );

        expect(state().requests).toHaveLength(2);
        expect(state().requestCount).toBe(1);
    });

    it("corrects a count realtime raised with no row to attach it to", () => {
        // A `conversation:request` arriving while no request tab was mounted
        // increments blind; the server is the authority the next time the
        // listing is read.
        state().applyRequest(incoming({ conversationId: "unknown" }));
        expect(state().requestCount).toBe(1);

        state().setRequests([], null);
        expect(state().requestCount).toBe(0);
    });
});

describe("setConversations", () => {
    it("never defines the unread count", () => {
        // The badge is the server's answer, not the length of a page. Deriving
        // it here is how it gets capped at the page size, and how a realtime
        // increment gets wiped by the next append.
        state().setUnreadCount(35);
        state().setConversations([conversation({ unreadCount: 2 })], null);

        expect(state().unreadCount).toBe(35);
    });
});

describe("applyIncoming", () => {
    it("rewrites a loaded row and moves it to the front", () => {
        state().setConversations(
            [conversation({ id: "c0" }), conversation({ id: "c1" })],
            null,
        );

        state().applyIncoming(incoming());

        const [first, second] = state().conversations;
        expect(first.id).toBe("c1");
        expect(first.lastMessagePreview).toBe("are you there");
        expect(first.lastMessageAt).toBe("2026-09-10T13:00:00.000Z");
        expect(first.unreadCount).toBe(1);
        expect(second.id).toBe("c0");
    });

    it("neither raises the badge nor re-reads the thread that is focused", () => {
        // A message arriving in the thread somebody is reading is read on
        // arrival. Raising the badge would leave a number they could only
        // clear by navigating away and coming back.
        state().setUnreadCount(2);
        state().setConversations([conversation({ unreadCount: 0 })], null);
        state().setFocusedConversation("c1");

        state().applyIncoming(incoming());

        expect(state().unreadCount).toBe(2);
        expect(state().conversations[0].unreadCount).toBe(0);
        // The bubble cannot be built from a preview, so the open thread is
        // told to re-read its newest page.
        expect(state().threadRevision).toBe(1);
    });

    it("raises the badge", () => {
        state().setUnreadCount(4);
        state().setConversations([conversation()], null);

        state().applyIncoming(incoming());

        expect(state().unreadCount).toBe(5);
    });

    it("asks the list to re-read when the row is not loaded", () => {
        // The payload is a preview, not a row: there is nothing to insert,
        // only a reason to ask again.
        state().setConversations([conversation({ id: "c0" })], null);

        state().applyIncoming(incoming({ conversationId: "elsewhere" }));

        expect(state().conversationsRevision).toBe(1);
        expect(state().conversations).toHaveLength(1);
    });

    it("costs no re-read when the row is loaded", () => {
        state().setConversations([conversation()], null);

        state().applyIncoming(incoming());

        expect(state().conversationsRevision).toBe(0);
    });
});

describe("applyRequest", () => {
    it("does not raise the unread badge", () => {
        // The whole point of the event being distinct from `message:new`: an
        // unanswered request must not be able to put a number on somebody's
        // tab, or an open inbox is a broadcast channel.
        state().setUnreadCount(0);
        state().setRequests([request({ id: "c1" })], null);

        state().applyRequest(incoming());

        expect(state().unreadCount).toBe(0);
        expect(state().requests[0].lastMessagePreview).toBe("are you there");
    });

    it("counts a request whose row is not loaded, and asks for a re-read", () => {
        state().applyRequest(incoming({ conversationId: "elsewhere" }));

        expect(state().requestCount).toBe(1);
        expect(state().requestsRevision).toBe(1);
    });
});

describe("upsertConversation", () => {
    beforeEach(() => {
        state().setRequests([request({ id: "c1" })], null);
    });

    it("moves an accepted thread out of the requests and into the inbox", () => {
        // Both halves matter: left in the request tab it would show in two
        // places at once until the next fetch.
        state().upsertConversation(conversation({ id: "c1" }));

        expect(state().requests).toHaveLength(0);
        expect(state().requestCount).toBe(0);
        expect(state().conversations[0].id).toBe("c1");
    });

    it("stops counting a request once it has been accepted", () => {
        expect(state().requestCount).toBe(1);

        state().upsertConversation(conversation({ id: "c1" }));

        expect(state().requestCount).toBe(0);
    });

    it("drops a declined thread from both lists", () => {
        // `DECLINED` is terminal and is never listed again.
        state().upsertConversation(
            conversation({ id: "c1", status: "DECLINED", canSend: false }),
        );

        expect(state().requests).toHaveLength(0);
        expect(state().conversations).toHaveLength(0);
        expect(state().requestCount).toBe(0);
    });

    it("patches the thread that is open, so it hears its own accept", () => {
        // Everything the thread screen draws — the request banner, the
        // composer, the closed notice — is read off `activeConversation`.
        // Left behind, accepting a request would leave the decision on screen
        // with no composer until the screen was reopened.
        const pending = request({ id: "c1" });
        state().setThread(pending, [], null);

        state().upsertConversation(conversation({ id: "c1" }));

        expect(state().activeConversation?.status).toBe("ACCEPTED");
        expect(state().activeConversation?.isRequest).toBe(false);
    });

    it("leaves a different open thread alone", () => {
        state().setThread(conversation({ id: "c9" }), [], null);

        state().upsertConversation(conversation({ id: "c1" }));

        expect(state().activeConversation?.id).toBe("c9");
    });

    it("does not duplicate a row it already holds", () => {
        state().setConversations([conversation({ id: "c1" })], null);

        state().upsertConversation(
            conversation({ id: "c1", lastMessagePreview: "newer" }),
        );

        expect(state().conversations).toHaveLength(1);
        expect(state().conversations[0].lastMessagePreview).toBe("newer");
    });
});

describe("the thread", () => {
    it("puts an appended page at the end, because the array runs newest first", () => {
        state().setThread(conversation(), [message({ id: "m2" })], "next");
        state().setThread(conversation(), [message({ id: "m1" })], null, true);

        expect(state().messages.map((m) => m.id)).toEqual(["m2", "m1"]);
        expect(state().messagesCursor).toBeNull();
    });

    it("keeps a withdrawn message in its place", () => {
        // The other participant may have replied to it. Removing the row
        // would leave their reply answering nothing — which is also why the
        // server keeps it.
        state().setThread(
            conversation(),
            [message({ id: "m2" }), message({ id: "m1" })],
            null,
        );

        state().markMessageDeleted("m1");

        const [, second] = state().messages;
        expect(state().messages).toHaveLength(2);
        expect(second.id).toBe("m1");
        expect(second.isDeleted).toBe(true);
        expect(second.content).toBe("");
        expect(second.mediaUrls).toEqual([]);
    });

    it("swaps an optimistic bubble for the server's copy", () => {
        state().setThread(conversation(), [], null);
        state().addMessage(message({ id: "temp-1" }));

        state().replaceMessage("temp-1", message({ id: "m9" }));

        expect(state().messages.map((m) => m.id)).toEqual(["m9"]);
    });

    it("keeps a sent message a refetch arrived too early to know about", () => {
        // A thread re-reads its newest page whenever realtime says it is
        // behind, which replaces the list — so a send that was in flight comes
        // back to find its placeholder gone. Dropping the answer would hide a
        // message that was in fact sent, and the obvious response to that is
        // to send it again.
        state().setThread(conversation(), [], null);
        state().addMessage(message({ id: "temp-1" }));
        state().setThread(conversation(), [message({ id: "m5" })], null);

        state().replaceMessage("temp-1", message({ id: "m9" }));

        expect(state().messages.map((m) => m.id)).toEqual(["m9", "m5"]);
    });

    it("does not add it twice when the refetch already brought it back", () => {
        state().setThread(conversation(), [message({ id: "m9" })], null);

        state().replaceMessage("temp-1", message({ id: "m9" }));

        expect(state().messages.map((m) => m.id)).toEqual(["m9"]);
    });

    it("zeroes the row without touching the global count", () => {
        // A thread that was never in a loaded page has no `unreadCount` to
        // subtract, so the caller re-reads the badge from the server instead.
        state().setUnreadCount(5);
        state().setConversations([conversation({ unreadCount: 3 })], null);

        state().markConversationRead("c1");

        expect(state().conversations[0].unreadCount).toBe(0);
        expect(state().unreadCount).toBe(5);
    });

    it("puts the thread away on the way out", () => {
        state().setThread(conversation(), [message()], "next");
        state().setFocusedConversation("c1");

        state().clearThread();

        expect(state().activeConversation).toBeNull();
        expect(state().messages).toHaveLength(0);
        expect(state().messagesCursor).toBeNull();
        expect(state().focusedConversationId).toBeNull();
    });
});

describe("reset", () => {
    it("empties both listings and both counts", () => {
        // Sign-out. Without this the next account opens the tab on the
        // previous one's conversations.
        state().setConversations([conversation()], "next");
        state().setRequests([request({ id: "r1" })], "next");
        state().setUnreadCount(7);
        state().setThread(conversation(), [message()], "next");
        state().setFocusedConversation("c1");

        state().reset();

        expect(state().conversations).toHaveLength(0);
        expect(state().requests).toHaveLength(0);
        expect(state().conversationsCursor).toBeNull();
        expect(state().requestsCursor).toBeNull();
        expect(state().unreadCount).toBe(0);
        expect(state().requestCount).toBe(0);
        expect(state().activeConversation).toBeNull();
        expect(state().messages).toHaveLength(0);
        expect(state().focusedConversationId).toBeNull();
    });
});
