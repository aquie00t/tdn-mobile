import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "../../core/platform/zustand-storage";

export type Theme = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "tdn-theme";

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

/**
 * Dark, not `"system"`.
 *
 * The app shipped dark, exactly as the web client did, so following the OS
 * would repaint it white for every account whose phone is set light — which
 * none of them asked for. Light is the thing being added, so light is the
 * thing opted into.
 *
 * There is no `resolveTheme` or `watchSystemTheme` here, and that is not an
 * omission: the web needed them to turn `"system"` into a concrete value and
 * to keep following the OS while the tab was open. NativeWind's runtime does
 * both, so the store holds the choice and nothing else.
 */
export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            theme: "dark",
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: THEME_STORAGE_KEY,
            storage: createJSONStorage(() => zustandStorage()),
        },
    ),
);
