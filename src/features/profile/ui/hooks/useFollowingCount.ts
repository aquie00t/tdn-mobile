import { useEffect, useState } from "react";

import { profileApi } from "../../data/profile.api";
import { useSessionStore } from "@core/session/session.store";

/**
 * How many accounts the signed-in reader already follows.
 *
 * Read here rather than handed over by whoever asked, so the answer is right
 * on a direct arrival where no gate has run. A failure counts as zero: the
 * same fail-open the onboarding gate takes, and it can only ever ask for more,
 * never fewer.
 *
 * `followingCount` is optional on `Profile` — it is absent from some of the
 * shapes that endpoint serves — so a missing number is nought rather than
 * `NaN` propagating into a requirement.
 */
export function useFollowingCount() {
    const username = useSessionStore((s) => s.user?.username);

    const [count, setCount] = useState(0);
    // Nothing to wait for without a username, so the initial value settles it
    // rather than an effect writing state on the first render.
    const [isLoading, setIsLoading] = useState(!!username);

    useEffect(() => {
        if (!username) return;

        let cancelled = false;

        profileApi
            .getProfile(username)
            .then((profile) => {
                if (!cancelled) setCount(profile.followingCount ?? 0);
            })
            .catch(() => {
                if (!cancelled) setCount(0);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [username]);

    return { count, isLoading };
}
