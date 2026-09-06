import "../shared/theme/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";

/**
 * Set at module scope, before the first component renders.
 *
 * This is the native counterpart of the inline script in the web client's
 * `index.html`: the theme has to be decided before the first paint, or the
 * screen shows one theme and then repaints in the other. Doing it in an effect
 * is one frame too late.
 *
 * Dark, not the system setting. The web app shipped dark-only, so following
 * the OS would repaint it white for every account whose phone is set light —
 * which none of them asked for. The theme store takes over from here once it
 * has read the stored choice.
 */
colorScheme.set("dark");

export default function RootLayout() {
    return (
        <>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }} />
        </>
    );
}
