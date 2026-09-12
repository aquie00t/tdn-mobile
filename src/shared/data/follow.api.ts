import { api } from "@core/api/client";

/**
 * Following and unfollowing, the two writes behind every follow button.
 *
 * In `shared/` rather than in the profile feature, because two features now
 * press these buttons: a profile or a follow list, and the onboarding flow,
 * whose whole gate is how many accounts have been followed. A feature may not
 * reach into another, and the alternative — a second copy of the pair — would
 * put the `DELETE`-with-a-body trap below in two places, which is exactly the
 * kind of thing that drifts.
 *
 * `/media` sits in `shared/` for the same reason and the rule is the same one:
 * an endpoint belongs to a feature until a second feature needs it.
 */
export const followApi = {
    follow: (targetId: string): Promise<void> =>
        api.post<void>("/follows", { targetId }),

    /**
     * A `DELETE` that carries a body, which is unusual enough to be worth
     * naming: the account to unfollow is in the payload rather than the path.
     *
     * `api.delete` takes no body of its own, so it goes through the options —
     * and the header has to be set by hand, because the client only writes
     * `Content-Type` for a request it serialised itself. Without it the server
     * receives a body it will not parse and answers 400, which an optimistic
     * caller shows as a button that un-presses itself a moment later.
     */
    unfollow: (targetId: string): Promise<void> =>
        api.delete<void>("/follows", {
            body: JSON.stringify({ targetId }),
            headers: { "Content-Type": "application/json" },
        }),
};
