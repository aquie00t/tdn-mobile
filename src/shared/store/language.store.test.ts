import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStore = vi.hoisted(() => new Map<string, string>());
const localeMock = vi.hoisted(() => ({
    value: [] as { languageCode: string | null }[],
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

import {
    detectLocale,
    LANGUAGE_STORAGE_KEY,
    useLanguageStore,
} from "./language.store";

beforeEach(() => {
    asyncStore.clear();
});

describe("detectLocale", () => {
    it("answers Turkish for a Turkish phone", () => {
        localeMock.value = [{ languageCode: "tr" }];
        expect(detectLocale()).toBe("tr");
    });

    it("matches on the language, not the region", () => {
        localeMock.value = [{ languageCode: "TR" }];
        expect(detectLocale()).toBe("tr");
    });

    it("answers English for anything else", () => {
        localeMock.value = [{ languageCode: "de" }];
        expect(detectLocale()).toBe("en");
    });

    it("does not crash when the device reports no language code", () => {
        // `getLocales()` is typed as a non-empty tuple, but `languageCode` is
        // `string | null` — this is the case that actually happens.
        localeMock.value = [{ languageCode: null }];
        expect(detectLocale()).toBe("en");
    });

    it("does not crash when the device reports no locales at all", () => {
        // The type says this cannot happen. Devices are not bound by types.
        localeMock.value = [];
        expect(detectLocale()).toBe("en");
    });
});

describe("the store", () => {
    it("persists a choice under the documented key", async () => {
        useLanguageStore.getState().setLocale("tr");

        await vi.waitFor(() => {
            expect(asyncStore.has(LANGUAGE_STORAGE_KEY)).toBe(true);
        });

        expect(JSON.parse(asyncStore.get(LANGUAGE_STORAGE_KEY)!)).toMatchObject(
            {
                state: { locale: "tr" },
            },
        );
    });
});
