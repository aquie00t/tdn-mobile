import { getLocales } from "expo-localization";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "../../core/platform/zustand-storage";

export type Locale = "en" | "tr";

/** Read by hand nowhere else, but kept named for the same reason the web does. */
export const LANGUAGE_STORAGE_KEY = "tdn-language";

interface LanguageState {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

/**
 * The phone's language, narrowed to the two the app speaks.
 *
 * `getLocales()` is typed as a non-empty tuple, so there is always a first
 * entry — but its `languageCode` is `string | null`, which is the case that
 * actually needs answering. A device that reports no language code gets
 * English rather than a crash.
 *
 * Exported for its test: this is the one piece of the language layer with a
 * platform behind it, so it is also the one worth pinning down.
 */
export function detectLocale(): Locale {
    const languageCode = getLocales()[0]?.languageCode;
    return languageCode?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

/**
 * Rehydration is asynchronous here, and it was not on the web.
 *
 * `localStorage` answered during the first render, so the stored locale was
 * already in place. `AsyncStorage` answers a tick later, which leaves a frame
 * holding {@link detectLocale}'s answer rather than the reader's choice — a
 * flash of the wrong language for someone whose phone is English and whose
 * account is Turkish. Harmless enough here; the theme has the same seam and it
 * is not harmless there, so the gate on `persist.hasHydrated()` lands with it.
 */
export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            locale: detectLocale(),
            setLocale: (locale) => set({ locale }),
        }),
        {
            name: LANGUAGE_STORAGE_KEY,
            storage: createJSONStorage(() => zustandStorage()),
        },
    ),
);
