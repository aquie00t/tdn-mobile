import { useEffect, useState } from "react";

import { getErrorMessage } from "@shared/utils/error-handler";

export interface SearchResults<T> {
    results: T[];
    isLoading: boolean;
    error: string | null;
}

/** What one finished search left behind, kept together so it cannot half-update. */
interface Answered<T> {
    query: string;
    results: T[];
    error: string | null;
}

/**
 * One search, against an already-settled query.
 *
 * The debounce is the caller's — `useDebouncedValue` — so this hook is the
 * same few lines for tags and for accounts, where the web keeps two files that
 * differ only in which API they call and which type they hold.
 *
 * **Nothing is set synchronously from the effect**, which is the shape the
 * rest of this repo's list hooks settled on: loading is *derived* from which
 * query has been answered, so there is no flag to raise on the way in and no
 * render spent raising it. The query, its results and its error are one piece
 * of state for the same reason — a results array that belongs to one query
 * while the error belongs to another is a screen showing both.
 *
 * `search` has to be stable across renders; both callers declare theirs at
 * module scope. A new function each render would refetch on every render.
 *
 * @param query - The settled query
 * @param search - What to call with it
 * @param minChars - Below this, nothing is searched and nothing is shown
 */
export function useSearchResults<T>(
    query: string,
    search: (q: string) => Promise<T[]>,
    minChars: number,
): SearchResults<T> {
    const [answered, setAnswered] = useState<Answered<T>>({
        query: "",
        results: [],
        error: null,
    });

    const isSearchable = query.length >= minChars;

    useEffect(() => {
        if (!isSearchable) return;

        let cancelled = false;

        search(query)
            .then((results) => {
                if (!cancelled) setAnswered({ query, results, error: null });
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setAnswered({
                        query,
                        results: [],
                        error: getErrorMessage(err),
                    });
                }
            });

        return () => {
            // The query moved on while this one was in flight. The newer
            // effect is already running, and this answer is about a word
            // nobody is looking for any more.
            cancelled = true;
        };
    }, [query, search, isSearchable]);

    /*
     * Below the floor the previous answer is still in state, and it is
     * deliberately not returned: emptying it would be a second render, and
     * showing it would be results for a word that is no longer in the box.
     */
    return {
        results: isSearchable ? answered.results : [],
        isLoading: isSearchable && answered.query !== query,
        error: isSearchable ? answered.error : null,
    };
}
