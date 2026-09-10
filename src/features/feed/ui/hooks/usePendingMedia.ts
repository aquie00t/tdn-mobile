import { useCallback, useEffect, useRef, useState } from "react";

import { feedApi } from "../../data/feed.api";
import { platform } from "@core/platform";
import type { Post } from "../../data/feed.types";

/**
 * Between checks. The worker runs about once a minute, so anything shorter is
 * asking a question whose answer cannot have changed.
 */
const POLL_INTERVAL_MS = 20_000;

/**
 * When to stop asking. A video that has not been judged in five minutes is not
 * about to be, and something is wrong further back — a feed left open on it
 * should not keep asking all afternoon. The manual button stays either way.
 */
const POLL_LIMIT_MS = 5 * 60_000;

export interface UsePendingMediaOptions {
    postId: string;
    mediaPending: boolean;
    /**
     * Whoever owns the copy of this post being rendered. Without one there is
     * nowhere to put the answer, so the caller offers no refresh at all rather
     * than a button that appears to do nothing.
     */
    onUpdated?: (post: Post) => void;
}

/**
 * Watches a post whose video is still being checked, and asks again until it
 * is not.
 *
 * Only this post, never the feed — `getPostById` says why.
 *
 * A rejected video ends the wait as surely as an accepted one: `mediaPending`
 * goes false either way, with `mediaUrls` left empty. There is no separate
 * failure to watch for here, and the author hears about a rejection through
 * their notifications.
 *
 * **Where the web reads `document.hidden`, this asks the app-state port.** A
 * backgrounded app is not being read, and Android throttles its timers without
 * promising by how much — so the interval keeps ticking and simply declines to
 * spend a request. Asking again on return is what actually matters, and the
 * next tick after the app comes back does it.
 */
export function usePendingMedia({
    postId,
    mediaPending,
    onUpdated,
}: UsePendingMediaOptions) {
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Held in a ref so a parent that rebuilds this callback every render does
    // not restart the interval each time and stretch the wait indefinitely.
    const onUpdatedRef = useRef(onUpdated);
    useEffect(() => {
        onUpdatedRef.current = onUpdated;
    }, [onUpdated]);

    const refresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const post = await feedApi.getPostById(postId);
            onUpdatedRef.current?.(post);
        } catch {
            // Swallowed on purpose. The placeholder is already the honest
            // state, and a toast for a poll nobody asked for would interrupt
            // reading to report that a video is still not ready.
        } finally {
            setIsRefreshing(false);
        }
    }, [postId]);

    useEffect(() => {
        if (!mediaPending) return;

        const startedAt = Date.now();
        const id = setInterval(() => {
            if (Date.now() - startedAt > POLL_LIMIT_MS) return;
            if (!platform.appState.isForeground()) return;
            void refresh();
        }, POLL_INTERVAL_MS);

        return () => clearInterval(id);
    }, [mediaPending, refresh]);

    return { refresh, isRefreshing };
}
