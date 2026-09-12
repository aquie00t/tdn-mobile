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
import { useApplyColorScheme } from "@shared/hooks/useTheme";
import { useInitialUnreadCount } from "@features/notifications/ui/hooks/useInitialUnreadCount";
import { useNotificationRealtime } from "@features/notifications/ui/hooks/useNotificationRealtime";
import { useRealtimeSocket } from "@core/realtime/useRealtimeSocket";
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
 * The things that belong to a session rather than to a screen: one socket, the
 * listener that turns its events into a badge, and the read that seeds that
 * badge.
 *
 * They live here rather than on the notifications tab, because a socket that
 * only exists while a tab is open is a socket that misses everything else.
 */
function SessionServices() {
    useRealtimeSocket();
    useNotificationRealtime();
    useInitialUnreadCount();
    return null;
}

export default function RootLayout() {
    const ready = useBootstrap();
    useApplyColorScheme();

    useAuthGate(ready);

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
