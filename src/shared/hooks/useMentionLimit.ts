import { useMemo } from "react";

import { MAX_MENTIONS, extractHandles } from "../utils/mentions";

/**
 * How many accounts the body being written names, and whether that is more
 * than the API will accept.
 *
 * The server counts the handles **written**, before it looks any of them up,
 * and answers 400 past ten. Mirroring the count here is what keeps that error
 * unreachable in ordinary use — the same reason both composers mirror their
 * character cap rather than letting the server explain it after the fact.
 *
 * Memoised because it runs a regex over the whole body, and a composer re-runs
 * it on every keystroke.
 *
 * @param content - The body as it stands
 */
export function useMentionLimit(content: string) {
    return useMemo(() => {
        const count = extractHandles(content).length;
        return { count, isOverLimit: count > MAX_MENTIONS, max: MAX_MENTIONS };
    }, [content]);
}
