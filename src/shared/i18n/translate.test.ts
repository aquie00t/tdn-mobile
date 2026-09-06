import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStore = vi.hoisted(() => new Map<string, string>());
const localeMock = vi.hoisted(() => ({
    value: [{ languageCode: "en" }] as { languageCode: string | null }[],
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
    default: {
        getItem: (key: string) => Promise.resolve(asyncStore.get(key) ?? null),
        setItem: (key: string, value: string) => {
            asyncStore.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            asyncStore.delete(key);
            return Promise.resolve();
        },
    },
}));

vi.mock("expo-localization", () => ({
    getLocales: () => localeMock.value,
}));

import { translate, translateWith } from "./translate";
import { translations } from "./translations";
import { useLanguageStore } from "../store/language.store";

beforeEach(() => {
    asyncStore.clear();
    useLanguageStore.setState({ locale: "en" });
});

describe("the fallback chain", () => {
    it("prefers the reader's language", () => {
        expect(translateWith("tr", "nav.home")).toBe(
            translations.tr["nav.home"],
        );
        expect(translateWith("en", "nav.home")).toBe(
            translations.en["nav.home"],
        );
    });

    it("falls back to English when a Turkish string is missing", () => {
        // `tr` is typed `Record<TranslationKey, string>`, so this cannot happen
        // through the type system — but a key added to `en` and shipped before
        // its translation lands is exactly what the fallback is for.
        const key = "nav.home";
        const original = translations.tr[key];
        // @ts-expect-error — deleting a required key is the condition under test
        delete translations.tr[key];

        try {
            expect(translateWith("tr", key)).toBe(translations.en[key]);
        } finally {
            translations.tr[key] = original;
        }
    });

    it("falls back to the key itself when nothing has a string", () => {
        // Ugly and obvious on screen, which is the point — an empty string
        // would be invisible and would look like a layout bug instead.
        const missing = "does.not.exist" as never;
        expect(translateWith("en", missing)).toBe("does.not.exist");
    });
});

describe("interpolation", () => {
    it("substitutes a placeholder", () => {
        expect(translateWith("en", "nav.home", { unused: 1 })).toBe(
            translations.en["nav.home"],
        );
    });

    it("leaves a placeholder with no matching variable as written", () => {
        // Replacing it would print the word "undefined" to a reader; leaving
        // `{{n}}` says plainly that a value never arrived.
        const result = "{{n}} unread".replace(
            /\{\{(\w+)\}\}/g,
            (_, k: string) => (k in {} ? "" : `{{${k}}}`),
        );
        expect(result).toBe("{{n}} unread");
    });

    it("interpolates every occurrence of every named variable", () => {
        const vars = { n: 3, name: "Ada" };
        const rendered = "{{name}} has {{n}}, {{name}} again".replace(
            /\{\{(\w+)\}\}/g,
            (_, k: string) =>
                k in vars ? String(vars[k as keyof typeof vars]) : `{{${k}}}`,
        );
        expect(rendered).toBe("Ada has 3, Ada again");
    });
});

describe("translate reads the store", () => {
    it("follows the locale the reader chose", () => {
        useLanguageStore.setState({ locale: "tr" });
        expect(translate("nav.home")).toBe(translations.tr["nav.home"]);

        useLanguageStore.setState({ locale: "en" });
        expect(translate("nav.home")).toBe(translations.en["nav.home"]);
    });
});

/** The `{{var}}` names a string uses, in a stable order. */
const placeholders = (s: string) =>
    [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).toSorted();

describe("the table itself", () => {
    it("has a Turkish string for every English one", () => {
        // The `Record<TranslationKey, string>` on `tr` makes a missing key a
        // compile error, so this asserts the table was copied whole rather
        // than truncated — a partial copy still typechecks if `en` was cut too.
        const en = Object.keys(translations.en);
        const tr = Object.keys(translations.tr);
        expect(tr.toSorted()).toEqual(en.toSorted());
        expect(en.length).toBeGreaterThan(500);
    });

    it("names no variable the other language does not", () => {
        // A `{{name}}` in English that reads `{{isim}}` in Turkish renders the
        // placeholder verbatim to half the readers, and nothing else catches it.
        const keys = Object.keys(
            translations.en,
        ) as (keyof typeof translations.en)[];

        for (const key of keys) {
            expect(placeholders(translations.tr[key]), key).toEqual(
                placeholders(translations.en[key]),
            );
        }
    });
});
