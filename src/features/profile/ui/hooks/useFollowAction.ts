import { useCallback, useState } from "react";

import { followTargetId } from "../../domain/follow-target";
import { followApi } from "@shared/data/follow.api";
import { reportError } from "@shared/utils/report-error";

export interface UseFollowActionOptions {
    /** Whatever carries the account's identity — a profile or a list row. */
    account: { id?: string; userId?: string };
    isFollowing: boolean;
    /**
     * Applied optimistically and rolled back on failure. The caller owns the
     * copy being drawn, so it owns the flip — the same arrangement the post
     * card uses for a like, and for the same reason: a row in a list is
     * unmounted as it scrolls past and would lose state it kept itself.
     */
    onChange: (isFollowing: boolean) => void;
}

/**
 * Following and unfollowing one account.
 *
 * A failure rolls the button back and says nothing; the reason goes to
 * `reportError`.
 *
 * There is no signed-out branch. The web opens its auth modal here; this app
 * is behind a sign-in wall, so there is nobody to open it for.
 */
export function useFollowAction({
    account,
    isFollowing,
    onChange,
}: UseFollowActionOptions) {
    const [isLoading, setIsLoading] = useState(false);

    const toggle = useCallback(async () => {
        if (isLoading) return;

        const targetId = followTargetId(account);

        if (!targetId) {
            // A caller passing nothing has a bug, and an empty string is not
            // dropped from a body the way `undefined` is — the request would
            // go out, fail validation, and un-press the button for no reason.
            reportError("follow", "Skipped — no target id was given.");
            return;
        }

        const wasFollowing = isFollowing;

        setIsLoading(true);
        onChange(!wasFollowing);

        try {
            if (wasFollowing) await followApi.unfollow(targetId);
            else await followApi.follow(targetId);
        } catch (err) {
            onChange(wasFollowing);
            reportError("follow", err);
        } finally {
            setIsLoading(false);
        }
    }, [account, isFollowing, isLoading, onChange]);

    return { toggle, isLoading };
}
