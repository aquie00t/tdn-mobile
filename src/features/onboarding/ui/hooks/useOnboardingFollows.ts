import { useCallback, useMemo, useState } from "react";

import type { BotProfile } from "../../data/bot.types";
import { followApi } from "@shared/data/follow.api";
import { getErrorMessage } from "@shared/utils/error-handler";
import { netFollowChange } from "../../domain/follow-requirement";
import { useToastStore } from "@shared/store/toast.store";

/**
 * Who the account follows while it is in the flow.
 *
 * `useFollowAction` keeps that state inside each row, which is right on a
 * profile and wrong here: the flow's only gate is *how many so far*, and a
 * counter cannot be assembled out of state the rows hold privately. So it
 * lives above the list and the rows are told what to render.
 *
 * **Nothing is seeded into state from the list.** The web copies `isFollowing`
 * out of each bot into a set in an effect, and then needs a second set and a
 * ref of everything it has already seen — because appending a page re-seeds
 * the first one and quietly restores a bot that was just unfollowed. Here the
 * server's answer stays where it arrived, in `accounts`, and this hook holds
 * only the *changes* made on top of it. Both sets are derived, there is no
 * effect, and re-seeding is not a thing that can happen.
 *
 * @param accounts - Every suggestion fetched so far
 */
export function useOnboardingFollows(accounts: BotProfile[]) {
    /** Rows touched in this flow: the id, and what it was set to. */
    const [changes, setChanges] = useState<Map<string, boolean>>(new Map());
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

    const addToast = useToastStore((s) => s.addToast);

    /** What was already true when each suggestion arrived. */
    const serverFollowedIds = useMemo(
        () =>
            new Set(
                accounts
                    .filter((bot) => bot.isFollowing)
                    .map((bot) => bot.userId),
            ),
        [accounts],
    );

    /** What the rows render. */
    const followedIds = useMemo(() => {
        const next = new Set(serverFollowedIds);

        for (const [userId, isFollowing] of changes) {
            if (isFollowing) next.add(userId);
            else next.delete(userId);
        }

        return next;
    }, [serverFollowedIds, changes]);

    const toggle = useCallback(
        async (userId: string) => {
            // Also what keeps the request count down: somebody tapping a slow
            // row repeatedly sends one request, not one per tap.
            if (pendingIds.has(userId)) return;

            const wasFollowing = followedIds.has(userId);

            setChanges((previous) =>
                new Map(previous).set(userId, !wasFollowing),
            );
            setPendingIds((previous) => new Set(previous).add(userId));

            try {
                // The id, never the handle — `/follows` takes an id, and this
                // list is the only place it comes from.
                if (wasFollowing) await followApi.unfollow(userId);
                else await followApi.follow(userId);
            } catch (err: unknown) {
                setChanges((previous) =>
                    new Map(previous).set(userId, wasFollowing),
                );
                addToast({ type: "error", message: getErrorMessage(err) });
            } finally {
                setPendingIds((previous) => {
                    const next = new Set(previous);
                    next.delete(userId);
                    return next;
                });
            }
        },
        [addToast, followedIds, pendingIds],
    );

    return {
        followedIds,
        serverFollowedIds,
        /*
         * The set itself rather than an `isPending(id)` helper, which is what
         * the web returns. An inline arrow is a new function on every render,
         * so a `renderItem` that closes over it is new on every render too,
         * and a `FlatList` handed a new `renderItem` re-renders every row it
         * is holding — the cost the memo on the card exists to avoid.
         */
        pendingIds,
        netChange: netFollowChange(followedIds, serverFollowedIds),
        toggle,
    };
}
