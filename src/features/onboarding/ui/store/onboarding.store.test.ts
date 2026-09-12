import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The store persists through `AsyncStorage`, which is native. Stood up as a
 * `Map`, the same way the keystore is in the client's spec.
 */
const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
    default: {
        getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
        setItem: (key: string, value: string) => {
            store.set(key, value);
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
    },
}));

import { useOnboardingStore } from "./onboarding.store";

beforeEach(() => {
    store.clear();
    useOnboardingStore.setState({ completedUserIds: [], interests: [] });
});

describe("complete", () => {
    it("records the account that finished", () => {
        useOnboardingStore.getState().complete("u1", ["AI"]);

        expect(useOnboardingStore.getState().completedUserIds).toEqual(["u1"]);
        expect(useOnboardingStore.getState().interests).toEqual(["AI"]);
    });

    it("keeps one entry per account", () => {
        useOnboardingStore.getState().complete("u1", ["AI"]);
        useOnboardingStore.getState().complete("u1", ["AI"]);

        expect(useOnboardingStore.getState().completedUserIds).toEqual(["u1"]);
    });

    it("does not let one account finish for another", () => {
        // A phone two people sign into. Without this the second account skips
        // the flow on the strength of the first having finished it.
        useOnboardingStore.getState().complete("u1", ["AI"]);
        useOnboardingStore.getState().complete("u2", ["GAME"]);

        expect(useOnboardingStore.getState().completedUserIds).toEqual([
            "u1",
            "u2",
        ]);
    });

    it("does not wipe stored fields when the gate settles it", () => {
        /*
         * An empty pick is the gate's signature: it marks the flow done off
         * the server's follow count, without anybody visiting the picker.
         * Writing that through would throw away fields chosen on a previous
         * visit.
         */
        useOnboardingStore.getState().setInterests(["FRONTEND", "BACKEND"]);
        useOnboardingStore.getState().complete("u1", []);

        expect(useOnboardingStore.getState().interests).toEqual([
            "FRONTEND",
            "BACKEND",
        ]);
    });
});

describe("setInterests", () => {
    it("replaces the selection rather than merging it", () => {
        // The picker owns the whole set — unticking a field has to remove it.
        useOnboardingStore.getState().setInterests(["AI", "GAME"]);
        useOnboardingStore.getState().setInterests(["AI"]);

        expect(useOnboardingStore.getState().interests).toEqual(["AI"]);
    });
});
