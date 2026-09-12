import "../shared/theme/global.css";

import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastHost } from "@shared/ui/Toast";
import { clearTokens, loadTokens } from "@core/session/tokens";
import { registerSessionExpiredHandler } from "@core/api/client";
import { useLanguageStore } from "@shared/store/language.store";
import { useSessionStore } from "@core/session/session.store";
import { MIN_FOLLOWS } from "@features/onboarding/domain/follow-requirement";
import { profileApi } from "@features/profile/data/profile.api";
import { useApplyColorScheme } from "@shared/hooks/useTheme";
import { useInitialUnreadCount } from "@features/notifications/ui/hooks/useInitialUnreadCount";
import { useNotificationRealtime } from "@features/notifications/ui/hooks/useNotificationRealtime";
import { useOnboardingStore } from "@features/onboarding/ui/store/onboarding.store";
import { usePushDevice } from "@core/push/usePushDevice";
import { usePushTapRouting } from "@features/notifications/ui/hooks/usePushTapRouting";
import { useRealtimeSocket } from "@core/realtime/useRealtimeSocket";
import { UpdateRequiredScreen } from "@features/update/ui/screens/UpdateRequiredScreen";
import { useUpdateGate } from "@features/update/ui/hooks/useUpdateGate";
import { useThemeStore } from "@shared/store/theme.store";

/**
 * Held open until the stored theme, language and session have been read.
 *
 * `AsyncStorage` and the keystore both answer a tick after the first render, so
 * without this the app paints its defaults — dark, English, signed out — and
 * then repaints. For language that is a flash of the wrong words; for the theme
 * it is a white screen on a dark install; and for the session it is worse than
 * a flash, because `getAccessToken()` answers `null` until `loadTokens()`
 * resolves and any request made in that window goes out unauthenticated.
 *
 * This is the native counterpart of the inline script in the web client's
 * `index.html`, which exists for the same reason.
 *
 * The splash's own background is set to the ground colour in `app.config.ts`.
 * Holding a white splash while waiting for a dark theme does not remove the
 * flash, it lengthens it.
 */
void SplashScreen.preventAutoHideAsync();

/** The three reads that have to finish before anything renders. */
function useBootstrap(): boolean {
    const [storesHydrated, setStoresHydrated] = useState(
        () =>
            useThemeStore.persist.hasHydrated() &&
            useLanguageStore.persist.hasHydrated() &&
            useSessionStore.persist.hasHydrated(),
    );
    const [tokensLoaded, setTokensLoaded] = useState(false);

    useEffect(() => {
        const check = () => {
            if (
                useThemeStore.persist.hasHydrated() &&
                useLanguageStore.persist.hasHydrated() &&
                useSessionStore.persist.hasHydrated()
            ) {
                setStoresHydrated(true);
            }
        };

        const unsubscribers = [
            useThemeStore.persist.onFinishHydration(check),
            useLanguageStore.persist.onFinishHydration(check),
            useSessionStore.persist.onFinishHydration(check),
        ];

        // They may all have finished between the initial state and this effect.
        check();

        return () => unsubscribers.forEach((off) => off());
    }, []);

    useEffect(() => {
        // Failing to read the keystore is not a reason to hold the splash
        // forever. The app opens signed out, which is recoverable; a splash
        // that never lifts is not.
        loadTokens().finally(() => setTokensLoaded(true));
    }, []);

    return storesHydrated && tokensLoaded;
}

/**
 * The sign-in wall.
 *
 * This app does not do guest browsing, and that is a deliberate difference from
 * the web client — which lets a reader through the whole feed and only asks for
 * a session when they try to change something. Here there is one front door.
 *
 * Written as a redirect rather than by branching what the root renders, because
 * the navigator has to exist before anything can be routed into it: returning a
 * different tree for a signed-out reader would unmount the router on every sign
 * in and out, and take the animation and the back stack with it.
 *
 * Both directions matter. Without a session, anywhere outside `(auth)` is
 * bounced to the front door; with one, `(auth)` is a screen nobody has any
 * business being on, so signing in leaves it immediately.
 */
function useAuthGate(ready: boolean) {
    const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
    const segments = useSegments();
    const inAuthFlow = segments[0] === "(auth)";

    useEffect(() => {
        // Routing before the stored session has been read would send every
        // returning account to the sign-in screen for a frame.
        if (!ready) return;

        if (!isAuthenticated && !inAuthFlow) {
            router.replace("/(auth)/identifier");
        } else if (isAuthenticated && inAuthFlow) {
            router.replace("/");
        }
    }, [ready, isAuthenticated, inAuthFlow]);
}

/**
 * Sends an account that follows fewer than {@link MIN_FOLLOWS} people through
 * the onboarding flow before it can reach the app.
 *
 * Written beside {@link useAuthGate} and subordinate to it: the check stands
 * down while anything in `(auth)` is on screen. That is this app's version of
 * the web's "not while the auth modal is open" rule, and it matters for the
 * same reason — registering leaves the session in place on
 * `/(auth)/verify-email`, and an account yanked off that screen loses the
 * verification step. It is also what keeps two effects from racing to
 * `replace` the same route, which has broken this layout before.
 *
 * Three more rules, all load-bearing:
 *
 * - **A failed profile request passes.** The gate is a requirement, not a
 *   trap, and no account may be locked out of the app because one request did
 *   not come back. Warned rather than swallowed: silence here made the whole
 *   flow look like it had never been built.
 * - **Finishing once settles it for good**, per user id. The check is
 *   `< MIN_FOLLOWS`, so without that the account would be dragged back in the
 *   moment it unfollowed somebody — which is nagging, not onboarding.
 * - **The verdict is stamped with the id it was reached for**, so signing into
 *   a second account in the same session re-checks rather than inheriting the
 *   first one's answer.
 *
 * The request only happens for an account that has not finished — which is a
 * handful of launches in its life — so the onboarding route reading the same
 * profile again for its own count costs one extra round trip on exactly those
 * launches, and buys a number that is also correct on a direct arrival.
 */
function useOnboardingGate(ready: boolean) {
    const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
    const userId = useSessionStore((s) => s.user?.id);
    const username = useSessionStore((s) => s.user?.username);

    const completedUserIds = useOnboardingStore((s) => s.completedUserIds);
    const complete = useOnboardingStore((s) => s.complete);

    const segments = useSegments();
    const inAuthFlow = segments[0] === "(auth)";
    const isOnOnboarding = segments[0] === "onboarding";

    const isCompleted = !!userId && completedUserIds.includes(userId);

    const skip =
        !ready || !isAuthenticated || inAuthFlow || isCompleted || !username;

    const [checked, setChecked] = useState<{
        userId: string;
        shouldRedirect: boolean;
    } | null>(null);

    useEffect(() => {
        if (skip || !userId || !username) return;

        let cancelled = false;

        profileApi
            .getProfile(username)
            .then((profile) => {
                if (cancelled) return;

                if ((profile.followingCount ?? 0) >= MIN_FOLLOWS) {
                    // Already met. Recorded so the check does not run again on
                    // this device, with no interests — the flow was never
                    // visited, and writing an empty pick through would wipe
                    // fields chosen on an earlier one.
                    complete(userId, []);
                    setChecked({ userId, shouldRedirect: false });
                } else {
                    setChecked({ userId, shouldRedirect: true });
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                // eslint-disable-next-line no-console
                console.warn(
                    "Onboarding check skipped — the profile request failed:",
                    err,
                );
                setChecked({ userId, shouldRedirect: false });
            });

        return () => {
            cancelled = true;
        };
    }, [skip, userId, username, complete]);

    useEffect(() => {
        if (skip || isOnOnboarding) return;
        if (!checked || checked.userId !== userId) return;
        if (!checked.shouldRedirect) return;

        router.replace("/onboarding");
        // `isOnOnboarding` is a dependency so that leaving the flow by any
        // other route — a tapped push notification, say — is turned around
        // rather than becoming a way past the gate.
    }, [skip, isOnOnboarding, checked, userId]);
}

/**
 * The things that belong to a session rather than to a screen: one socket, the
 * listener that turns its events into a badge, the read that seeds that badge,
 * and the two halves of push — registering this phone, and opening what a
 * tapped notification points at.
 *
 * They live here rather than on the notifications tab, because a socket that
 * only exists while a tab is open is a socket that misses everything else —
 * and a phone that only registers for push once somebody visits that tab is a
 * phone that never registers.
 */
function SessionServices() {
    useRealtimeSocket();
    useNotificationRealtime();
    useInitialUnreadCount();
    usePushDevice();
    usePushTapRouting();
    return null;
}

export default function RootLayout() {
    const ready = useBootstrap();
    const update = useUpdateGate();
    useApplyColorScheme();

    /*
     * Both gates stand down while the app is blocked, and they have to: they
     * route, and a build that is too old renders no navigator to route into.
     * Calling `replace` against nothing is a warning in the log and a
     * redirect that silently does not happen.
     */
    const canRoute = ready && !update.isBlocked;

    useAuthGate(canRoute);
    useOnboardingGate(canRoute);

    useEffect(() => {
        /*
         * A refresh that could not be renewed.
         *
         * Clearing the session is the whole of it — the gate above watches that
         * flag and does the routing, so this does not navigate itself. Two
         * things racing to `replace` the same route is how a reader ends up
         * behind a screen they cannot back out of.
         */
        registerSessionExpiredHandler(() => {
            useSessionStore.getState().clearSession();
            void clearTokens();
        });
    }, []);

    useEffect(() => {
        if (ready) void SplashScreen.hideAsync();
    }, [ready]);

    // The splash is still up, so this frame is never seen. Rendering the
    // navigator before the theme is known is what puts the wrong colour on
    // screen underneath it.
    if (!ready) return null;

    /*
     * Instead of the navigator, not over it.
     *
     * This is the one screen in the app that replaces the tree rather than
     * being routed to, and it is also the only terminal one: there is nothing
     * behind it worth keeping and no way past it that should exist. Rendered
     * here, `SessionServices` is never mounted either — a build nobody is
     * allowed to use has no business holding a socket open or registering
     * itself for notifications.
     */
    if (update.isBlocked) {
        return (
            <SafeAreaProvider>
                <StatusBar style="auto" />
                <UpdateRequiredScreen storeUrl={update.storeUrl} />
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            {/*
             * Mounted as a child so it starts only once the splash has lifted.
             *
             * Called from the layout body they would run on the first render,
             * where the session store may already say somebody is signed in
             * while `loadTokens()` has not resolved — the window CLAUDE.md
             * warns about, in which every request goes out unauthenticated and
             * the socket has no token to send.
             */}
            <SessionServices />
            {/*
             * "auto" rather than "light". `setColorScheme` writes through
             * React Native's `Appearance`, so the bar follows the theme on its
             * own — pinned to light it would be white icons on a white page
             * the moment somebody chooses the light theme.
             */}
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
            <ToastHost />
        </SafeAreaProvider>
    );
}
