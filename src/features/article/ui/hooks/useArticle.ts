import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiErrorResponse } from "@core/api/api.types";
import type { Article } from "../../data/article.types";
import { articleApi } from "../../data/article.api";
import { getErrorMessage } from "@shared/utils/error-handler";

function isNotFound(err: unknown): boolean {
    return (
        !!err &&
        typeof err === "object" &&
        (err as Partial<ApiErrorResponse>).status === 404
    );
}

/**
 * One article, read by slug.
 *
 * **A draft belonging to somebody else answers `404`, not `403`**, so a
 * failure here is an ordinary not-found and never a "this exists but is
 * unpublished". That is the server's decision and this keeps it: the screen
 * says the article was not found, which is all anybody is entitled to know.
 *
 * @param slug - From the route
 */
export function useArticle(slug: string) {
    const [article, setArticle] = useState<Article | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);

    const generation = useRef(0);

    const load = useCallback(async () => {
        const run = ++generation.current;

        try {
            const found = await articleApi.getArticleBySlug(slug);
            if (generation.current !== run) return;

            setArticle(found);
            setNotFound(false);
            setError(null);
        } catch (err) {
            if (generation.current !== run) return;

            if (isNotFound(err)) setNotFound(true);
            else setError(getErrorMessage(err));
        } finally {
            if (generation.current === run) setIsLoading(false);
        }
    }, [slug]);

    const retry = useCallback(async () => {
        setIsLoading(true);
        await load();
    }, [load]);

    /*
     * `set-state-in-effect` follows `load` into the callback and finds the
     * writes inside it. None runs synchronously: every one is in a promise
     * continuation a full round trip after this effect has returned, which is
     * the "update it from the event that caused the change" the rule exists to
     * steer towards. Hiding them one call level deeper until the linter stops
     * noticing would be the same code with worse structure.
     */
    useEffect(() => {
        // eslint-disable-next-line react/set-state-in-effect
        void load();

        return () => {
            generation.current += 1;
        };
    }, [load]);

    /** Applied to the copy this screen holds, so the counts stay in step. */
    const patch = useCallback((changes: Partial<Article>) => {
        setArticle((held) => (held ? { ...held, ...changes } : held));
    }, []);

    return { article, isLoading, error, notFound, retry, patch };
}
