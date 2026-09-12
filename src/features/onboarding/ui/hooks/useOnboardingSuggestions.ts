import { useCallback, useEffect, useRef, useState } from "react";

import { BOT_PAGE_SIZE, botApi } from "../../data/bot.api";
import type { BotProfile } from "../../data/bot.types";
import type { CategoryValue } from "@shared/constants/categories";
import { getErrorMessage } from "@shared/utils/error-handler";
import { useToastStore } from "@shared/store/toast.store";

/**
 * The bots publishing in the chosen fields, newest page appended.
 *
 * @param categories - The fields picked in step one
 */
export function useOnboardingSuggestions(categories: CategoryValue[]) {
    const addToast = useToastStore((s) => s.addToast);

    /**
     * The values, not the array. A caller re-rendering hands over a new array
     * with the same contents, and an effect keyed on that identity would
     * refetch on every keystroke elsewhere on the screen.
     */
    const categoryKey = categories.join(",");

    const [accounts, setAccounts] = useState<BotProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);

    /**
     * Which read is the current one.
     *
     * Bumped when the list is restarted and again when the hook goes away, so
     * a "show more" still in flight cannot append a page onto a list that has
     * been thrown out from under it. A counter rather than the `cancelled`
     * flag the rest of the repo uses, because `retry` restarts the read from
     * outside the effect and has no flag of its own to raise.
     */
    const generation = useRef(0);

    const picked = useCallback(
        (): CategoryValue[] =>
            categoryKey ? (categoryKey.split(",") as CategoryValue[]) : [],
        [categoryKey],
    );

    const load = useCallback((): Promise<void> => {
        const run = ++generation.current;

        return botApi
            .getBots({ categories: picked(), limit: BOT_PAGE_SIZE, offset: 0 })
            .then((page) => {
                if (generation.current !== run) return;
                setAccounts(page);
                // `meta` carries a count, but `apiClient` unwraps `data`
                // before anyone sees it — so a full page is the only signal
                // that there is another behind it.
                setHasMore(page.length === BOT_PAGE_SIZE);
                setError(null);
            })
            .catch((err: unknown) => {
                if (generation.current !== run) return;
                setAccounts([]);
                setHasMore(false);
                setError(getErrorMessage(err));
            })
            .finally(() => {
                if (generation.current === run) setIsLoading(false);
            });
    }, [picked]);

    useEffect(() => {
        void load();

        return () => {
            generation.current += 1;
        };
    }, [load]);

    /**
     * Pressing "try again" is an event rather than a render, so this one can
     * raise the spinner straight away — and it has to, or the button looks
     * dead until the request comes back.
     */
    const retry = useCallback(() => {
        setIsLoading(true);
        setError(null);
        void load();
    }, [load]);

    const loadMore = useCallback(() => {
        if (isLoading || isLoadingMore || !hasMore) return;

        const run = generation.current;

        setIsLoadingMore(true);

        botApi
            .getBots({
                categories: picked(),
                limit: BOT_PAGE_SIZE,
                offset: accounts.length,
            })
            .then((page) => {
                if (generation.current !== run) return;

                setAccounts((previous) => {
                    /*
                     * The ranking key is follower count, and following a bot
                     * raises it — so a bot can slide across the page boundary
                     * mid-flow and arrive twice. Two rows under one key is a
                     * `FlatList` warning; two rows for one account is worse,
                     * because following one of them leaves the other stale.
                     */
                    const seen = new Set(previous.map((bot) => bot.userId));
                    return [
                        ...previous,
                        ...page.filter((bot) => !seen.has(bot.userId)),
                    ];
                });
                setHasMore(page.length === BOT_PAGE_SIZE);
            })
            .catch((err: unknown) => {
                // Toasted rather than raised into `error`: the screen renders
                // the error state *instead of* the list, and losing a screen
                // of bots the reader may already have followed in order to
                // report a failed second page is the wrong trade.
                addToast({ type: "error", message: getErrorMessage(err) });
            })
            .finally(() => {
                // Unconditional, unlike the first page: nothing else raises
                // this flag, so a superseded page that left it set would
                // disable "show more" for good.
                setIsLoadingMore(false);
            });
    }, [accounts.length, addToast, hasMore, isLoading, isLoadingMore, picked]);

    return {
        accounts,
        isLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        retry,
    };
}
