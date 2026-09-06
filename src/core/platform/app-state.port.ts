/**
 * Whether anybody is looking at the app.
 *
 * This has no equivalent on the web and it is load-bearing here. Both mobile
 * platforms close the realtime socket the moment the app is backgrounded, so
 * the API treats push as the second transport and expects the socket to come
 * and go. Data also goes stale while the app is away in a way a tab's never
 * quite does.
 *
 * Two questions are answered from one signal, and they are not the same
 * question: `useRealtimeSocket` needs to know when to redial, and a feed needs
 * to know when to re-read. Keeping both behind one port is what stops every
 * screen growing its own `AppState` listener.
 */
export interface AppStatePort {
    isForeground(): boolean;

    /** Returns the unsubscribe function. */
    subscribe(listener: (isForeground: boolean) => void): () => void;
}
