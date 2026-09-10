import { useCallback, useState } from "react";

import { followTargetId } from "../../domain/follow-target";
import { getErrorMessage } from "@shared/utils/error-handler";
import { profileApi } from "../../data/profile.api";
import { useToastStore } from "@shared/store/toast.store";

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
 * There is no signed-out branch. The web opens its auth modal here; this app
 * is behind a sign-in wall, so there is nobody to open it for.
 */
export function useFollowAction({
    account,
    isFollowing,
    onChange,
}: UseFollowActionOptions) {
    const [isLoading, setIsLoading] = useState(false);
    const addToast = useToastStore((s) => s.addToast);

    const toggle = useCallback(async () => {
        if (isLoading) return;

        const targetId = followTargetId(account);

        if (!targetId) {
            // Loud rather than swallowed: a caller passing nothing has a bug,
            // and an empty string is not dropped from a body the way
            // `undefined` is — the request would go out, fail validation, and
            // the rollback would un-press the button with nothing said.
            // eslint-disable-next-line no-console
            console.warn("Follow skipped — no target id was given.");
            return;
        }

        const wasFollowing = isFollowing;

        setIsLoading(true);
        onChange(!wasFollowing);

        try {
            if (wasFollowing) await profileApi.unfollow(targetId);
            else await profileApi.follow(targetId);
        } catch (err) {
            onChange(wasFollowing);
            addToast({ type: "error", message: getErrorMessage(err) });
        } finally {
            setIsLoading(false);
        }
    }, [account, isFollowing, isLoading, onChange, addToast]);

    return { toggle, isLoading };
}
