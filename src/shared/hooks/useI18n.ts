import { useCallback } from "react";

import { translateWith } from "../i18n/translate";
import { useLanguageStore } from "../store/language.store";
import type { TranslationKey } from "../i18n/translations";

/**
 * The translation function for components.
 *
 * Subscribes to the locale, so a screen re-renders when the language changes —
 * which is the whole difference between this and `translate`. Not to be
 * confused with `useTranslation` on the web, which is an unrelated feature:
 * detecting what language a *post* is written in and asking the server to
 * translate it.
 */
export function useI18n() {
    const locale = useLanguageStore((s) => s.locale);

    const t = useCallback(
        (key: TranslationKey, vars?: Record<string, string | number>) =>
            translateWith(locale, key, vars),
        [locale],
    );

    return { t, locale };
}
