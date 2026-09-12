import { useEffect, useState } from "react";

import { APP_BUILD } from "@shared/constants/app-build";
import { clientMetaApi } from "../../data/client-meta.api";

export interface UpdateGate {
    /** Whether this build must be updated before the app can be used. */
    isBlocked: boolean;
    /** Where to send somebody. Empty when the API has no store URL set. */
    storeUrl: string;
}

/**
 * Asks the API, once per launch, whether this build is still supported.
 *
 * **The splash is not held for it.** This is a network call, and a splash that
 * waits on the network is a splash that never lifts on a phone with no signal.
 * The request goes out on mount, in parallel with everything else, and the app
 * is briefly usable before an answer that blocks it arrives. That window is
 * acceptable: the floor is advisory — the API serves an old build perfectly
 * well, it simply cannot promise to keep doing so — and the alternative fails
 * in the one situation where being told to update is least useful.
 *
 * **Every failure passes.** Offline, timed out, a 500, an answer that will not
 * parse: none of them block. An app that bricks itself because the one
 * endpoint that decides whether it may run was unreachable is worse than an
 * old build staying open, and this is the single call with the power to do
 * that to every phone at once.
 *
 * Asked once and not again. A floor that changes while somebody has the app
 * open reaches them at the next launch, which is soon enough for a number that
 * moves when a release is published.
 */
export function useUpdateGate(): UpdateGate {
    const [gate, setGate] = useState<UpdateGate>({
        isBlocked: false,
        storeUrl: "",
    });

    useEffect(() => {
        let cancelled = false;

        clientMetaApi
            .getClientMeta(APP_BUILD)
            .then((meta) => {
                if (cancelled) return;

                // `updateRequired` is the server's answer, not a comparison
                // repeated here. `storeUrl` is only ever read behind it, so it
                // is stored together with it rather than on its own.
                setGate({
                    isBlocked: meta.updateRequired,
                    storeUrl: meta.storeUrl,
                });
            })
            .catch(() => {
                // Left open. See above: this is the fail-open, and it is the
                // most important line in the file.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return gate;
}
