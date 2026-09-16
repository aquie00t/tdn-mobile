import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiErrorResponse } from "@core/api/api.types";
import { getErrorMessage } from "@shared/utils/error-handler";
import { messageApi, THREAD_PAGE_LIMIT } from "../../data/message.api";
import { platform } from "@core/platform";
import { useMessageStore } from "../store/message.store";

function isNotFound(err: unknown): boolean {
    return (
        !!err &&
        typeof err === "object" &&
        (err as Partial<ApiErrorResponse>).status === 404
    );
}

/**
 * One thread: its messages, its cursor, and who has read what.
 *
 * The first page carries the conversation itself, so opening a thread is a
 * single request rather than a listing plus a lookup — which is why this hook
 * owns `activeConversation` as well as `messages`.
 *
 * **A conversation the reader does not participate in answers `404`, not
 * `403`**, so that thread membership cannot be probed, and a thread hidden by
 * a block answers the same way. It is surfaced as "no such conversation" for
 * the same reason: telling the two apart on screen would hand back exactly the
 * fact the status code is withholding.
 *
 * @param conversationId - The thread to open
 * @param isScreenFocused - Whether the reader is looking at it now
 */
export function useConversation(
    conversationId: string,
    isScreenFocused: boolean,
) {
    const setThread = useMessageStore((s) => s.setThread);
    const clearThread = useMessageStore((s) => s.clearThread);
    const setFocused = useMessageStore((s) => s.setFocusedConversation);
    const markConversationRead = useMessageStore((s) => s.markConversationRead);
    const setUnreadCount = useMessageStore((s) => s.setUnreadCount);
    const cursor = useMessageStore((s) => s.messagesCursor);
    const threadRevision = useMessageStore((s) => s.threadRevision);

    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    /** Whether an older page is already out. See `useConversations`. */
    const inFlight = useRef(false);

    /**
     * Which thread the store's single slot belongs to.
     *
     * `messages` and `activeConversation` are one slot rather than a cache
     * keyed by id, so an answer that arrives after the screen has gone writes
     * a stale conversation into it: open a thread, go straight back, open a
     * different one, and the first one's name and bubbles are what is on
     * screen until the second request lands. Bumped on the way out, so a
     * superseded answer is dropped rather than written.
     */
    const generation = useRef(0);

    /**
     * Clears the reader's unread count and moves their watermark, then
     * **re-reads the badge from the server** rather than subtracting locally.
     *
     * Subtracting would need this conversation to be in the loaded inbox page,
     * and usually it is not — a thread reached from a profile or a push
     * notification was never in one. A wrong guess there is permanent, because
     * nothing else recomputes the badge.
     *
     * Reading a `PENDING` conversation emits no event, so opening a request
     * does not signal receipt to whoever sent it.
     */
    const markRead = useCallback(async () => {
        try {
            await messageApi.markRead(conversationId);
            markConversationRead(conversationId);

            /*
             * The badge is the one value here that something else is also
             * writing: the socket raises it for *other* conversations while
             * this request is in the air. So the server's answer is taken only
             * if nothing moved the count in the meantime — otherwise a zero
             * that left the server before a message arrived would put the
             * badge back down, with nothing to correct it until the inbox is
             * opened. The inbox guards its own read the same way.
             */
            const before = useMessageStore.getState().unreadCount;
            const count = await messageApi.getUnreadCount();

            if (useMessageStore.getState().unreadCount === before) {
                setUnreadCount(count);
            }
        } catch {
            // The badge is cosmetic and corrects itself on the next read. An
            // interruption here would be about our bookkeeping, not theirs.
        }
    }, [conversationId, markConversationRead, setUnreadCount]);

    /**
     * The newest page. Every state write happens after the request settles, so
     * this is safe to call straight from an effect — the loading flag is
     * lowered here for the same reason.
     */
    const fetchHead = useCallback(async () => {
        const run = generation.current;

        try {
            const page = await messageApi.getThread(conversationId, {
                limit: THREAD_PAGE_LIMIT,
            });

            if (generation.current !== run) return;

            setThread(
                page.data.conversation,
                page.data.messages,
                page.meta?.nextCursor ?? null,
            );
            setNotFound(false);
            setError(null);
        } catch (err) {
            if (generation.current !== run) return;

            if (isNotFound(err)) setNotFound(true);
            else setError(getErrorMessage(err));
        } finally {
            /*
             * Lowered here rather than by each caller, so the one path that
             * raises it — the retry — is the only one that has to think about
             * it, and the effects below need no state write of their own.
             */
            if (generation.current === run) setIsLoading(false);
        }
    }, [conversationId, setThread]);

    const retry = useCallback(async () => {
        setIsLoading(true);
        await fetchHead();
    }, [fetchHead]);

    /** Backwards through history, a page at a time. */
    const loadOlder = useCallback(async () => {
        // Read at call time so this keeps one identity as the cursor moves.
        const next = useMessageStore.getState().messagesCursor;
        if (inFlight.current || !next) return;

        const run = generation.current;
        inFlight.current = true;
        setIsLoadingOlder(true);

        try {
            const page = await messageApi.getThread(conversationId, {
                limit: THREAD_PAGE_LIMIT,
                cursor: next,
            });

            // The write that goes most wrong when it is late: appending adds
            // history to whatever thread happens to be in the slot now.
            if (generation.current !== run) return;

            setThread(
                page.data.conversation,
                page.data.messages,
                page.meta?.nextCursor ?? null,
                true,
            );
            setError(null);
        } catch (err) {
            if (generation.current === run) setError(getErrorMessage(err));
        } finally {
            setIsLoadingOlder(false);
            inFlight.current = false;
        }
    }, [conversationId, setThread]);

    /*
     * Put the thread away on the way out.
     *
     * Without this the previous conversation stays on screen for as long as
     * the next one takes to arrive, which reads as the wrong thread rather
     * than as loading. The generation bump is the other half of the same job:
     * it stops a request still in the air writing into the slot this has just
     * emptied.
     *
     * `conversationId` is in the dependencies although nothing here reads it,
     * and the suppression says so: it is what makes this run when the screen
     * is handed a different thread rather than only when it goes away.
     */
    useEffect(() => {
        return () => {
            generation.current += 1;
            clearThread();
        };
        // eslint-disable-next-line react/exhaustive-effect-dependencies
    }, [conversationId, clearThread]);

    /*
     * Reading the thread, and saying it has been read.
     *
     * "Focused" means the reader is looking at it *now*, which on a phone is
     * two conditions rather than one: this screen is the one on top of its
     * stack, and the app is in the foreground. Either failing means a message
     * arriving here has been read by nobody, and the badge should say so.
     *
     * **The head is re-read every time both become true, not only on mount.**
     * The socket is closed for the whole time the app is in the background, so
     * anything that arrived in that window came by push and nothing on this
     * screen heard about it. Marking read without re-reading would clear those
     * messages' unread state without ever having drawn them — the reader would
     * be told they had read something they were never shown.
     *
     * `set-state-in-effect` follows `fetchHead` into the callback and finds
     * the writes inside it. None runs synchronously: every one is in a promise
     * continuation a full round trip after this effect has returned, which is
     * the "update it from the event that caused the change" the rule exists to
     * steer towards.
     */
    useEffect(() => {
        if (!isScreenFocused) return;

        const sync = (isForeground: boolean) => {
            setFocused(isForeground ? conversationId : null);
            if (isForeground) void fetchHead().then(markRead);
        };

        // eslint-disable-next-line react/set-state-in-effect
        sync(platform.appState.isForeground());
        const unsubscribe = platform.appState.subscribe(sync);

        return () => {
            unsubscribe();
            setFocused(null);
        };
    }, [conversationId, isScreenFocused, setFocused, fetchHead, markRead]);

    /*
     * Realtime delivered a message for this thread. Its payload is a preview
     * rather than a `Message` — there is no `content` in it — so the newest
     * page is re-read instead of a bubble being invented from half a row.
     *
     * Compared against a ref rather than run on every change of the
     * dependencies, because the effect above marks read and this one would
     * otherwise re-read the thread each time it does.
     */
    const seenRevision = useRef(threadRevision);
    useEffect(() => {
        if (threadRevision === seenRevision.current) return;
        seenRevision.current = threadRevision;
        void fetchHead().then(markRead);
    }, [threadRevision, fetchHead, markRead]);

    return {
        isLoading,
        isLoadingOlder,
        error,
        notFound,
        hasOlder: cursor !== null,
        loadOlder,
        retry,
    };
}
