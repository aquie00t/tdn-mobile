/**
 * Whether there is a connection.
 *
 * On the web this was `navigator.onLine`, which is close enough to true. On a
 * phone it is a real question with real answers — a connection can be up,
 * up-but-unreachable, or metered — and the socket's reconnect backoff pauses
 * on it rather than burning its five retries against an aeroplane.
 */
export interface NetworkPort {
    isOnline(): boolean;

    /** Returns the unsubscribe function. */
    subscribe(listener: (isOnline: boolean) => void): () => void;
}
