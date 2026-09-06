import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStore = vi.hoisted(() => new Map<string, string>());

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

import { THEME_STORAGE_KEY, useThemeStore } from "./theme.store";

beforeEach(() => {
    asyncStore.clear();
    useThemeStore.setState({ theme: "dark" });
});

describe("the theme store", () => {
    it("defaults to dark rather than the system setting", () => {
        // The app shipped dark. Following the OS would repaint it white for
        // everyone whose phone is set light, which none of them asked for.
        expect(useThemeStore.getInitialState().theme).toBe("dark");
    });

    it("persists a choice under the documented key", async () => {
        useThemeStore.getState().setTheme("light");

        await vi.waitFor(() => {
            expect(asyncStore.has(THEME_STORAGE_KEY)).toBe(true);
        });

        expect(JSON.parse(asyncStore.get(THEME_STORAGE_KEY)!)).toMatchObject({
            state: { theme: "light" },
        });
    });

    it("keeps system as a storable choice", async () => {
        // "system" is a third state, not the absence of a choice: NativeWind
        // resolves it at runtime and follows the OS while the app is open.
        useThemeStore.getState().setTheme("system");
        expect(useThemeStore.getState().theme).toBe("system");

        await vi.waitFor(() => {
            expect(
                JSON.parse(asyncStore.get(THEME_STORAGE_KEY) ?? "{}"),
            ).toMatchObject({ state: { theme: "system" } });
        });
    });
});
