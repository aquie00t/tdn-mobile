import { useCallback, useEffect, useRef, useState } from "react";

import type { Trend } from "../../data/trends.types";
import { getErrorMessage } from "@shared/utils/error-handler";
import { trendsApi } from "../../data/trends.api";

/**
 * What is being tagged lately.
 *
 * Read once when the screen mounts. Trends move over days — the window is the
 * server's, and the copy names it — so re-reading them on every focus would be
 * a request per tab switch for a list that is the same all afternoon.
 *
 * A payload without `trends` is an empty list rather than a crash: the web's
 * note says a missing field took the whole page down on `.length`, and the
 * shape is the server's to change.
 */
export function useTrends() {
    const [trends, setTrends] = useState<Trend[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Which read is the current one. Bumped when the list is restarted and
     * again when the hook goes away, so a superseded answer cannot write over
     * a newer one — the same arrangement the onboarding suggestions use, and
     * for the same reason: `retry` restarts the read from outside the effect
     * and has no cancellation flag of its own.
     */
    const generation = useRef(0);

    const load = useCallback((): Promise<void> => {
        const run = ++generation.current;

        return trendsApi
            .getTrends()
            .then((data) => {
                if (generation.current !== run) return;
                setTrends(data?.trends ?? []);
                setError(null);
            })
            .catch((err: unknown) => {
                if (generation.current !== run) return;
                setTrends([]);
                setError(getErrorMessage(err));
            })
            .finally(() => {
                if (generation.current === run) setIsLoading(false);
            });
    }, []);

    useEffect(() => {
        void load();

        return () => {
            generation.current += 1;
        };
    }, [load]);

    /** An event, so the spinner can go up straight away. */
    const retry = useCallback(() => {
        setIsLoading(true);
        setError(null);
        void load();
    }, [load]);

    return { trends, isLoading, error, retry };
}
