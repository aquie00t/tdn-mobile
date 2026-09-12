import { useCallback, useEffect, useRef, useState } from "react";
import { useRootNavigationState, useRouter } from "expo-router";

import { platform } from "@core/platform";
import type { PushTarget } from "@core/push/push-target";
import { pushTarget } from "@core/push/push-target";
import { useSessionStore } from "@core/session/session.store";

/**
 * Opens what a tapped notification points at.
 *
 * Lives in this feature rather than in `core/push` because it is the half that
 * knows about screens, and `core/` does not get to know about screens. The
 * rule it routes by is pure and sits in `core/push/push-target.ts`, beside the
 * payload it reads — the same line the realtime socket is split along.
 *
 * Two things arrive here and they are not the same event: a tap while the app
 * is running, and a tap that *started* the app. The port delivers both through
 * one listener, and the second is the one with an ordering problem — the
 * response exists before the navigator does, and before the stored session has
 * been read.
 */
export function usePushTapRouting(): void {
    const router = useRouter();

    /*
     * Whether there is a navigator to push onto.
     *
     * A cold-start tap resolves within a tick of the first render, which can
     * be before the root layout has mounted. Navigating then is dropped with a
     * warning, and the reader lands on the feed wondering what they tapped.
     */
    const rootState = useRootNavigationState();
    const isNavigatorReady = Boolean(rootState?.key);

    /*
     * And whether there is an account to open it for. A cold-start tap races
     * the sign-in wall: the gate in the root layout is still deciding where
     * this launch belongs, and pushing a post on top of that decision either
     * loses the push or shows somebody else's post to a signed-out phone.
     */
    const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

    /** The tap, held until both of those are true. */
    const [tapped, setTapped] = useState<PushTarget | null>(null);

    /**
     * What has already been navigated to.
     *
     * The alternative — clearing `tapped` once it is handled — is a `setState`
     * inside the effect that handled it, and so a second render to no effect.
     * Identity is enough of a comparison here because every tap produces a
     * fresh object, including a second tap on the same notification.
     */
    const handled = useRef<PushTarget | null>(null);

    const open = useCallback(
        (target: PushTarget) => {
            switch (target.kind) {
                case "post":
                    router.push({
                        pathname: "/post/[id]",
                        params: { id: target.id },
                    });
                    return;
                case "comment":
                    router.push({
                        pathname: "/comments/[id]",
                        params: { id: target.id },
                    });
                    return;
                default:
                    /*
                     * The list, for a payload that named nothing openable — a
                     * follow, an article, or a type this build does not know.
                     * It holds the same notification with the fields the push
                     * could not carry, so the tap still lands somewhere that
                     * explains itself.
                     */
                    router.push("/notifications");
            }
        },
        [router],
    );

    /*
     * Subscribed once, and it reads nothing but the payload. Rebuilding this
     * subscription would also be a second read of the cold-start response,
     * which is held by the OS rather than by this app.
     */
    useEffect(
        () => platform.push.onTapped((data) => setTapped(pushTarget(data))),
        [],
    );

    useEffect(() => {
        if (!tapped || tapped === handled.current) return;
        if (!isAuthenticated || !isNavigatorReady) return;

        handled.current = tapped;
        open(tapped);
    }, [tapped, isAuthenticated, isNavigatorReady, open]);
}
