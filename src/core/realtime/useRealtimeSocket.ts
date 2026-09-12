import { useEffect, useRef } from "react";

import { BASE_URL } from "../api/client";
import { getAccessToken } from "../session/tokens";
import { platform } from "../platform";
import { translate } from "@shared/i18n/translate";
import { useSessionStore } from "../session/session.store";
import { useToastStore } from "@shared/store/toast.store";

/**
 * The API registers its realtime routes under the same `/api/v1` prefix as
 * every REST endpoint, with a `GET /ws` inside. Omitting the prefix on the web
 * meant the socket dialled a path the server does not serve, and it never
 * connected on any environment — so this is derived from `BASE_URL` rather
 * than written out a second time, and overridable for a local API the same way
 * the REST base is.
 */
export const WS_URL =
    process.env.EXPO_PUBLIC_WS_URL ??
    `${BASE_URL.replace(/^http/, "ws")}/realtime/ws`;

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const MAX_RETRIES = 5;

interface WsMessage {
    event: string;
    /**
     * `auth_success` carries no payload, so this cannot be required. It is
     * `unknown` rather than a union because the frame is narrowed by `event`
     * below, and one union would let a notification payload be read as a
     * message one wherever the two happen to overlap.
     */
    payload?: unknown;
}

export type RealtimeHandler = (event: string, payload: unknown) => void;

const handlers = new Set<RealtimeHandler>();

/**
 * Registers a listener for whatever the socket receives.
 *
 * **This is why the connection can live in `core/`.** The web's socket imports
 * the notification store and the message store directly, which would be a
 * boundary violation here — `core/` may not reach into a feature, and the rule
 * is checked rather than agreed. Inverting it costs one registry: the socket
 * knows nothing about what the events mean, and each feature registers what it
 * cares about. `registerSessionExpiredHandler` on the API client is the same
 * arrangement for the same reason.
 *
 * Direct messages will ride this socket too rather than opening their own —
 * the API is explicit that a client holds one connection — so messaging adds
 * a second listener here rather than a second socket.
 *
 * @param handler - Called with every frame that is not `auth_success`
 * @returns The unsubscribe function
 */
export function subscribeToRealtime(handler: RealtimeHandler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
}

function dispatch(event: string, payload: unknown): void {
    for (const handler of handlers) handler(event, payload);
}

/**
 * One socket for the session, mounted once by the root layout.
 *
 * **Two things here exist only on a phone**, and both are the roadmap's:
 *
 * The connection closes when the app goes to the background and dials again
 * when it comes back. Both platforms tear a socket down behind the app's back
 * anyway, and the API expects it — push is the second transport for exactly
 * this reason. Holding a dead socket open just means the first event after a
 * return is missed silently.
 *
 * And the backoff pauses while the device is offline rather than spending its
 * five retries in a tunnel. `NetworkPort`'s "unknown counts as online" is the
 * right way round for this: a dial that fails is recoverable, a dial never
 * attempted because the app guessed offline is not.
 */
export function useRealtimeSocket(): void {
    const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

    const socketRef = useRef<WebSocket | null>(null);
    const retryCountRef = useRef(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isActiveRef = useRef(false);

    useEffect(() => {
        if (!isAuthenticated) return;

        isActiveRef.current = true;
        retryCountRef.current = 0;

        const clearRetry = () => {
            if (retryTimerRef.current) {
                clearTimeout(retryTimerRef.current);
                retryTimerRef.current = null;
            }
        };

        /**
         * The next attempt, or the notice that there will not be one.
         *
         * Shared by the two paths that need it: a connection that dropped, and
         * a dial that had no token to send yet.
         */
        function scheduleRetry(): void {
            if (!isActiveRef.current) return;

            if (retryCountRef.current >= MAX_RETRIES) {
                useToastStore.getState().addToast({
                    type: "info",
                    message: translate("common.notificationsUnavailable"),
                });
                return;
            }

            const delay = Math.min(
                BACKOFF_BASE_MS * 2 ** retryCountRef.current,
                BACKOFF_MAX_MS,
            );
            retryCountRef.current += 1;
            clearRetry();
            retryTimerRef.current = setTimeout(connect, delay);
        }

        const close = () => {
            clearRetry();
            socketRef.current?.close();
            socketRef.current = null;
        };

        function connect(): void {
            if (!isActiveRef.current) return;
            if (!platform.appState.isForeground()) return;

            /*
             * One socket at a time.
             *
             * Two things call this — the app coming back to the foreground and
             * the network returning — and on a phone waking up they arrive
             * together. Without this the second dial orphans the first, whose
             * handlers are still attached: it closes later, is no longer the
             * one held here, and schedules a retry on top of a healthy
             * connection.
             */
            const existing = socketRef.current;
            if (
                existing &&
                (existing.readyState === WebSocket.CONNECTING ||
                    existing.readyState === WebSocket.OPEN)
            ) {
                return;
            }

            /*
             * Read at dial time, never captured.
             *
             * `apiClient` refreshes the access token by writing straight to
             * the keystore and its in-memory mirror; nothing in the session
             * store changes, so this effect does not re-run. A token read once
             * would be re-sent, already expired, on every reconnect for the
             * rest of the session.
             */
            const token = getAccessToken();

            /*
             * There is a window at boot where this is null and the session
             * store already says somebody is signed in: the store and the
             * keystore hydrate independently, and `getAccessToken()` answers
             * null until `loadTokens()` resolves. Returning silently here left
             * the socket unconnected for the whole session, because nothing
             * would call this again.
             */
            if (!token) {
                scheduleRetry();
                return;
            }

            const socket = new WebSocket(WS_URL);
            socketRef.current = socket;

            /*
             * Assigned rather than added as listeners. React Native's
             * `WebSocket` supports both, and one handler per event is exactly
             * what this wants: a socket that is replaced on every redial would
             * otherwise accumulate listeners from the sockets before it.
             */
            // eslint-disable-next-line unicorn/prefer-add-event-listener
            socket.onopen = () => {
                socket.send(JSON.stringify({ event: "auth", token }));
            };

            // eslint-disable-next-line unicorn/prefer-add-event-listener
            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(String(event.data)) as WsMessage;

                    /*
                     * The retry budget resets here and not in `onopen`.
                     *
                     * The server accepts the upgrade before it has seen the
                     * auth frame and only then closes a bad token with 1008,
                     * so `onopen` says nothing about whether the connection is
                     * usable. Resetting there meant a rejected token could
                     * never exhaust the budget, and the web redialled once a
                     * second for the life of the tab.
                     */
                    if (message.event === "auth_success") {
                        retryCountRef.current = 0;
                        return;
                    }

                    dispatch(message.event, message.payload);
                } catch {
                    // A frame this build cannot parse is not worth a crash.
                }
            };

            // eslint-disable-next-line unicorn/prefer-add-event-listener
            socket.onerror = () => {
                // Handled by `onclose`, which always follows.
            };

            // eslint-disable-next-line unicorn/prefer-add-event-listener
            socket.onclose = () => {
                if (!isActiveRef.current) return;
                // A socket that has already been replaced. Its close is
                // history, not a reason to dial again.
                if (socketRef.current !== socket) return;

                // Offline, or away: neither is a failure worth spending the
                // budget on. The subscriptions below dial again.
                if (
                    !platform.network.isOnline() ||
                    !platform.appState.isForeground()
                ) {
                    return;
                }

                scheduleRetry();
            };
        }

        const unsubscribeAppState = platform.appState.subscribe(
            (isForeground) => {
                if (isForeground) {
                    retryCountRef.current = 0;
                    connect();
                } else {
                    close();
                }
            },
        );

        const unsubscribeNetwork = platform.network.subscribe((isOnline) => {
            if (!isOnline) return;
            retryCountRef.current = 0;
            connect();
        });

        connect();

        return () => {
            isActiveRef.current = false;
            unsubscribeAppState();
            unsubscribeNetwork();
            close();
        };
        /*
         * The session alone. `dispatch` reaches its stores through
         * `getState()`, so subscribing to a store action here would tear the
         * socket down and redial it on any change that gave the action a new
         * identity.
         */
    }, [isAuthenticated]);
}
