import { useCallback, useRef, useState } from "react";

import { blockApi } from "../data/block.api";
import { reportError } from "../utils/report-error";

/**
 * Blocking and unblocking, for the profile header and the Settings list.
 *
 * **Not optimistic**, unlike the likes and follows around it — the exception
 * `docs/roadmap.md` records. A like flips one icon and a failed one flips it
 * back; a block hides an account from a reader who then believes it worked,
 * and nothing on screen could tell them otherwise, because the timeline is
 * empty either way. So the request is awaited and the caller is told the
 * outcome: on success the screen changes, on failure it stays as it was and
 * the control is offered again. The reason goes to `reportError`.
 *
 * `pendingId` rather than a boolean: the Settings list draws an unblock button
 * per row, and one shared flag would grey out all of them at once.
 *
 * There is no signed-out branch. The web opens its auth modal here; this app
 * is behind a sign-in wall, so there is nobody to open it for.
 */
export function useBlockAction() {
    const [pendingId, setPendingId] = useState<string | null>(null);

    /*
     * The guard against a second request, kept in a ref rather than read from
     * `pendingId`. Two taps inside one frame both see the state from before
     * either was handled, so a state check lets both through — and the second
     * spends one of five requests a minute on an answer already on its way.
     */
    const inFlightRef = useRef(false);

    const run = useCallback(
        async (
            targetId: string | null,
            action: (id: string) => Promise<unknown>,
        ): Promise<boolean> => {
            if (!targetId) {
                // An empty id is not dropped from a body the way `undefined`
                // is, and would reach the server as a validation failure the
                // reader never asked for. A caller passing nothing has a bug.
                reportError("block", "Skipped — no target id was given.");
                return false;
            }

            if (inFlightRef.current) return false;

            inFlightRef.current = true;
            setPendingId(targetId);

            try {
                await action(targetId);
                return true;
            } catch (err) {
                reportError("block", err);
                return false;
            } finally {
                inFlightRef.current = false;
                setPendingId(null);
            }
        },
        [],
    );

    const block = useCallback(
        (targetId: string | null) => run(targetId, blockApi.block),
        [run],
    );

    const unblock = useCallback(
        (targetId: string | null) => run(targetId, blockApi.unblock),
        [run],
    );

    return { block, unblock, pendingId, isPending: pendingId !== null };
}
