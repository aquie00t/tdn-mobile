import { useLanguageStore } from "../store/language.store";
import { translations } from "./translations";
import type { Locale } from "../store/language.store";
import type { TranslationKey } from "./translations";

/**
 * Framework-free translation lookup, for code that runs outside a React render
 * — utils, socket callbacks, the error layer. Components use `useI18n`
 * instead, so they re-render when the locale changes.
 *
 * The fallback chain is Turkish, then English, then the key itself. The last
 * step matters: a key with no string anywhere renders as `feed.community`,
 * which is ugly and obvious, where an empty string would be invisible.
 */
export function translateWith(
    locale: Locale,
    key: TranslationKey,
    vars?: Record<string, string | number>,
): string {
    let str: string = translations[locale][key] ?? translations.en[key] ?? key;

    if (vars) {
        // A placeholder with no matching variable is left as written. Replacing
        // it with `undefined` would put the word "undefined" in front of a
        // reader; leaving `{{n}}` says plainly that a value never arrived.
        str = str.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
            k in vars ? String(vars[k]) : `{{${k}}}`,
        );
    }

    return str;
}

export function translate(
    key: TranslationKey,
    vars?: Record<string, string | number>,
): string {
    return translateWith(useLanguageStore.getState().locale, key, vars);
}
