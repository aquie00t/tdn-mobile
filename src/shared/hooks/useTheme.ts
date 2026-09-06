import { useColorScheme } from "nativewind";
import { useEffect } from "react";

import { useThemeStore } from "../store/theme.store";
import type { Theme } from "../store/theme.store";

/**
 * Applies the stored choice to the runtime. Mounted once, in the root layout.
 *
 * `setColorScheme` takes `"light" | "dark" | "system"` and resolves the last
 * one itself, including following the OS while the app is open — so this hook
 * is the whole of what the web spread across `resolveTheme`,
 * `systemPrefersDark`, `watchSystemTheme` and a `data-theme` stamp.
 *
 * Worth knowing: the call writes through React Native's `Appearance`, not just
 * NativeWind's own state. Setting the theme therefore also moves the status
 * bar, the keyboard's appearance and any native picker — which is what you
 * want, but it means the store is not the sole owner of the value. The OS is a
 * participant, and `"system"` is a live subscription rather than a snapshot.
 */
export function useTheme(): {
    theme: Theme;
    setTheme: (theme: Theme) => void;
} {
    const theme = useThemeStore((s) => s.theme);
    const setTheme = useThemeStore((s) => s.setTheme);
    const { setColorScheme } = useColorScheme();

    useEffect(() => {
        setColorScheme(theme);
    }, [theme, setColorScheme]);

    return { theme, setTheme };
}
