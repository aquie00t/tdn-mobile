import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
    NativeSyntheticEvent,
    TextInputSelectionChangeEventData,
} from "react-native";

import {
    PROFILE_SEARCH_MIN_CHARS,
    profileSearchApi,
} from "../data/profile-search.api";
import type { ProfileSearchItem } from "../data/profile-search.types";
import { insertMention, readActiveHandle } from "../utils/mentions";
import { reportError } from "../utils/report-error";
import { useDebouncedValue } from "./useDebouncedValue";

/** How long typing has to pause before a search goes out. */
const DEBOUNCE_MS = 300;

/** Enough to choose from without pushing the field off a small screen. */
const SUGGESTION_LIMIT = 5;

interface SearchState {
    /** The query these results answer. */
    query: string;
    results: ProfileSearchItem[];
}

/**
 * Suggests accounts while an `@handle` is being typed into a composer.
 *
 * **Positioned by the composer, not by the caret.** The web measures the
 * caret by mirroring a textarea's typography into a hidden element; React
 * Native has nothing to measure. So the list is anchored in the composer's own
 * layout — under the field in the post composer, above it in the comment box —
 * which keeps it on screen above the keyboard without knowing where the caret
 * is drawn.
 *
 * The caret *index* is known, from `onSelectionChange`, and that is all
 * `readActiveHandle` needs.
 *
 * **There is no way to dismiss the list, and that is not an omission.** The
 * web closes it on Escape and on a click elsewhere; a phone has neither. The
 * back key is swallowed by the keyboard while somebody is typing, which is the
 * whole of the time this is on screen, so a dismissal would be an affordance
 * nothing can reach. It closes when the handle ends, when one is chosen, and
 * when the caret moves off it — which is every way it is actually left.
 *
 * There is no mention-search endpoint; the API says to use profile search,
 * which refuses a query under two characters with a 400. So the list opens
 * once two have been typed, after a 300 ms pause. A request answered after the
 * query moved on is dropped. A failed search closes the list and goes to
 * `reportError` — the author can finish the handle by hand.
 *
 * @param value - What the composer holds
 */
export function useMentionAutocomplete(value: string) {
    const [caret, setCaret] = useState<number | null>(null);
    /**
     * A caret position to put back after an insertion, handed to the field's
     * `selection` prop for one render and then released. Held controlled for
     * longer and the field fights the person typing into it.
     */
    const [selection, setSelection] = useState<
        { start: number; end: number } | undefined
    >(undefined);
    const [search, setSearch] = useState<SearchState>({
        query: "",
        results: [],
    });
    const requestRef = useRef(0);

    const active = useMemo(
        () => (caret === null ? null : readActiveHandle(value, caret)),
        [value, caret],
    );

    const query = active ? active.query : "";
    const isSearchable = query.length >= PROFILE_SEARCH_MIN_CHARS;
    const debounced = useDebouncedValue(query, DEBOUNCE_MS);

    useEffect(() => {
        if (debounced.length < PROFILE_SEARCH_MIN_CHARS) return;

        const requestId = ++requestRef.current;

        profileSearchApi
            .searchProfiles(debounced, SUGGESTION_LIMIT)
            .then((results) => {
                if (requestId !== requestRef.current) return;
                setSearch({ query: debounced, results });
            })
            .catch((err: unknown) => {
                if (requestId !== requestRef.current) return;
                setSearch({ query: debounced, results: [] });
                reportError("mention.search", err);
            });
    }, [debounced]);

    // Results are shown only for the query they answer, so a slow answer for
    // "ad" never sits under "adam".
    const suggestions = search.query === query ? search.results : [];
    const isSearching = isSearchable && search.query !== query;

    const onSelectionChange = useCallback(
        (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
            setCaret(event.nativeEvent.selection.end);
            setSelection(undefined);
        },
        [],
    );

    /**
     * Writes the chosen account over the handle being typed and returns the
     * new body for the composer to store. `null` when nothing is being typed.
     */
    const select = useCallback(
        (item: ProfileSearchItem): string | null => {
            if (!active) return null;

            const next = insertMention(value, active, item.username);
            setCaret(next.caret);
            setSelection({ start: next.caret, end: next.caret });
            return next.text;
        },
        [active, value],
    );

    return {
        /** Whether a list belongs on screen: searching, or with rows to show. */
        isOpen: isSearchable && (isSearching || suggestions.length > 0),
        isSearching,
        suggestions,
        selection,
        onSelectionChange,
        select,
    };
}
