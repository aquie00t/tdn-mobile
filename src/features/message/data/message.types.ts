/**
 * `DECLINED` is terminal and is never listed. It still reaches the client as
 * the status of a conversation reopened by `POST /conversations`, which
 * returns the declined thread unchanged rather than a new one — so the type
 * carries it even though no listing can ask for it.
 */
export type ConversationStatus = "PENDING" | "ACCEPTED" | "DECLINED";

/** The two the listing accepts. Asking it for `DECLINED` returns nothing. */
export type ConversationListStatus = Exclude<ConversationStatus, "DECLINED">;

export interface ConversationParticipant {
    id: string;
    username: string;
    fullName?: string;
    /** NOT NULL server-side — always an absolute URL. */
    avatarUrl: string;
}

export interface Conversation {
    id: string;
    status: ConversationStatus;
    /**
     * The reader owns the accept/decline decision on this thread.
     *
     * `isRequest` and `canSend` are resolved per reader by the server, and
     * **everything here renders from them rather than from `status`**. The two
     * are not the same question: the *initiator* of a pending conversation may
     * already write to it and has nothing to decide, so `status === "PENDING"`
     * alone answers neither.
     */
    isRequest: boolean;
    canSend: boolean;
    /** Always the other party, never the reader. */
    participant: ConversationParticipant;
    /** Unread by the reader. */
    unreadCount: number;
    /** Null while the thread is empty. */
    lastMessagePreview: string | null;
    lastMessageAt: string | null;
    /**
     * When the other participant last opened the thread — null if never. A
     * sent message counts as seen when its `createdAt` precedes this.
     *
     * Read state is per conversation, not per message: the API tracks one
     * watermark each way and there is no per-message receipt to ask for. The
     * inbox does not draw it; the thread screen does.
     */
    otherLastReadAt: string | null;
    createdAt: string;
}

/**
 * The payload `message:new` and `conversation:request` share.
 *
 * A truncated **preview**, not the message — there is no `content` here, and
 * that shapes everything downstream: it is enough to rewrite a row that is
 * already loaded and nowhere near enough to become one that is not.
 */
export interface IncomingMessagePayload {
    conversationId: string;
    messageId: string;
    senderId: string;
    preview: string;
    hasMedia: boolean;
    createdAt: string;
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    /** Empty on a withdrawn message. */
    content: string;
    /** Absolute URLs. Empty while `mediaPending`, and after `mediaRejected`. */
    mediaUrls: string[];
    /** Borderline content: blur it behind a tap rather than hiding it. */
    isSensitive: boolean;
    /** A video is stored but not yet cleared. The text is served normally. */
    mediaPending: boolean;
    /** Moderation refused the attachments; the files are gone, the text stays. */
    mediaRejected: boolean;
    /**
     * The sender withdrew it. The row is a tombstone and keeps its place — the
     * other participant may have replied to it, and removing it would leave
     * that reply talking to nothing.
     */
    isDeleted: boolean;
    isMine: boolean;
    createdAt: string;
}

/**
 * The first page of a thread carries the conversation itself, so opening one
 * is a single request rather than a listing plus a lookup.
 */
export interface ThreadPage {
    conversation: Conversation;
    messages: Message[];
}

/** Server-enforced. Mirrored so the composer never sends a doomed body. */
export const MESSAGE_MAX_LENGTH = 4000;

/**
 * `POST /messages/media` refuses a fifth file, so nothing offers one. The same
 * number `/media` holds for posts, and the same reason it is mirrored.
 */
export const MESSAGE_MAX_MEDIA = 4;

export interface MessageReadPayload {
    conversationId: string;
    /** Who did the reading. */
    senderId: string;
    readAt: string;
}

export interface MessageDeletedPayload {
    conversationId: string;
    messageId: string;
    senderId: string;
}

/**
 * Delivered to the **sender only**. The read path withholds unscanned media,
 * so from the recipient's side the file never existed and there is nothing to
 * withdraw.
 */
export interface MediaRejectedPayload {
    conversationId: string;
    messageId: string;
    senderId: string;
}
