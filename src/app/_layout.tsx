import "../shared/theme/global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastHost } from "../shared/ui/Toast";
import { useLanguageStore } from "../shared/store/language.store";
import { useTheme } from "../shared/hooks/useTheme";
import { useThemeStore } from "../shared/store/theme.store";

/**
 * Held open until the stored theme and language have been read.
 *
 * `AsyncStorage` answers a tick after the first render, so without this the app
 * paints its default — dark, English — and then repaints. For language that is
 * a flash of the wrong words; for the theme it is a white screen on a dark
 * install. This is the native counterpart of the inline script in the web
 * client's `index.html`, which exists for exactly the same reason.
 *
 * The splash's own background is set to the ground colour in `app.config.ts`.
 * Holding a white splash while waiting for a dark theme does not remove the
 * flash, it lengthens it.
 */
void SplashScreen.preventAutoHideAsync();

/** Both persisted stores, or neither — one gate for the pair. */
function usePersistedStores(): boolean {
    const [hydrated, setHydrated] = useState(
        () =>
            useThemeStore.persist.hasHydrated() &&
            useLanguageStore.persist.hasHydrated(),
    );

    useEffect(() => {
        const check = () => {
            if (
                useThemeStore.persist.hasHydrated() &&
                useLanguageStore.persist.hasHydrated()
            ) {
                setHydrated(true);
            }
        };

        const unsubscribers = [
            useThemeStore.persist.onFinishHydration(check),
            useLanguageStore.persist.onFinishHydration(check),
        ];

        // Both may have finished between the initial state and this effect.
        check();

        return () => unsubscribers.forEach((off) => off());
    }, []);

    return hydrated;
}

export default function RootLayout() {
    const hydrated = usePersistedStores();
    useTheme();

    useEffect(() => {
        if (hydrated) void SplashScreen.hideAsync();
    }, [hydrated]);

    // The splash is still up, so this frame is never seen. Rendering the
    // navigator before the theme is known is what puts the wrong colour on
    // screen underneath it.
    if (!hydrated) return null;

    return (
        <SafeAreaProvider>
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
