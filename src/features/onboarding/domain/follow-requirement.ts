/** How many accounts a new user has to follow before the flow lets them out. */
export const MIN_FOLLOWS = 5;

export interface FollowRequirementInput {
    /**
     * How many accounts the server says this one already follows, bots
     * followed on an earlier visit included.
     */
    alreadyFollowing: number;
    /**
     * Suggestions on screen that are not already followed on the server —
     * the follows this step can still ask for.
     */
    followable: number;
    /**
     * Whether the list is done growing: it errored, or the last page was
     * short. A page still in flight is not final.
     */
    listIsFinal: boolean;
    /** Follows minus unfollows made during this visit. */
    netChange: number;
}

export interface FollowRequirement {
    /**
     * What the heading asks for, before the list is taken into account. The
     * number a person is told, which is not always the number the button
     * waits for.
     */
    stillNeeded: number;
    /** What the finish button actually waits for. */
    required: number;
    /** What to show against it. */
    progress: number;
    canFinish: boolean;
}

/**
 * How many more accounts this flow may ask for, and whether it is satisfied.
 *
 * Four decisions live here, and every one of them is a way to trap somebody in
 * the flow or let them out of it too early. On the web they are spelled out
 * inside the page's JSX, where none of them can be tested.
 *
 * **Follows already on the books count.** The gate opens at
 * {@link MIN_FOLLOWS} *in total*, so telling an account that follows four
 * people to follow five more is a different requirement than the one that sent
 * it here.
 *
 * **Bots that arrived already followed cannot also be the answer.** They are
 * part of `alreadyFollowing` already, so `followable` excludes them — counting
 * them twice would let a returning user out having followed nobody.
 *
 * **The requirement drops to what the list can supply, but only once the list
 * is final.** An endpoint that answered with nothing, or did not answer at
 * all, must not leave an account behind a requirement that nothing on screen
 * can satisfy. While a page is in flight the full requirement stands, so the
 * finish button is never briefly open over a list that has not arrived.
 *
 * **Progress is a net change, not the size of the followed set.** Unfollowing
 * a bot from an earlier visit has to move the number back down.
 *
 * @param input - The state of the flow
 * @returns What to ask for and whether it has been met
 */
export function followRequirement({
    alreadyFollowing,
    followable,
    listIsFinal,
    netChange,
}: FollowRequirementInput): FollowRequirement {
    const stillNeeded = Math.max(0, MIN_FOLLOWS - alreadyFollowing);

    const required = listIsFinal
        ? Math.min(stillNeeded, Math.max(0, followable))
        : stillNeeded;

    return {
        stillNeeded,
        required,
        progress: Math.max(0, netChange),
        canFinish: netChange >= required,
    };
}

/**
 * Follows minus unfollows, against what was true when the suggestions arrived.
 *
 * The profile's `followingCount` already counts every bot followed on an
 * earlier visit, so the *set* of followed bots is the wrong input to the gate
 * and this difference is the right one. It goes negative, deliberately:
 * unfollowing two bots from a previous visit is −2, and a flow that reported
 * that as progress of nought would let the account finish on the strength of
 * follows it has just undone.
 *
 * @param followed - What the cards are rendering
 * @param serverFollowed - What was already true when each card arrived
 * @returns The net change, which may be negative
 */
export function netFollowChange(
    followed: ReadonlySet<string>,
    serverFollowed: ReadonlySet<string>,
): number {
    let net = 0;

    for (const id of followed) {
        if (!serverFollowed.has(id)) net += 1;
    }

    for (const id of serverFollowed) {
        if (!followed.has(id)) net -= 1;
    }

    return net;
}
