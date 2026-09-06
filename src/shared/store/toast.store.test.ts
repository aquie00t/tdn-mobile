import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let counter = 0;
vi.mock("expo-crypto", () => ({
    randomUUID: () => `id-${++counter}`,
}));

import { TOAST_DURATION_MS, useToastStore } from "./toast.store";

beforeEach(() => {
    counter = 0;
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
});

afterEach(() => {
    vi.useRealTimers();
});

describe("the toast store", () => {
    it("gives every toast an id of its own", () => {
        const { addToast } = useToastStore.getState();
        addToast({ type: "info", message: "one" });
        addToast({ type: "info", message: "two" });

        const ids = useToastStore.getState().toasts.map((t) => t.id);
        expect(new Set(ids).size).toBe(2);
    });

    it("dismisses itself after four seconds", () => {
        useToastStore.getState().addToast({ type: "error", message: "boom" });
        expect(useToastStore.getState().toasts).toHaveLength(1);

        vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
        expect(useToastStore.getState().toasts).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it("expires each toast on its own clock", () => {
        // The timer is per toast, not a sweep: a second one arriving must not
        // extend the first one's stay or cut it short.
        const { addToast } = useToastStore.getState();
        addToast({ type: "info", message: "first" });
        vi.advanceTimersByTime(TOAST_DURATION_MS / 2);
        addToast({ type: "info", message: "second" });

        vi.advanceTimersByTime(TOAST_DURATION_MS / 2);
        expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual([
            "second",
        ]);

        vi.advanceTimersByTime(TOAST_DURATION_MS / 2);
        expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it("can be dismissed by hand before its timer runs", () => {
        useToastStore.getState().addToast({ type: "info", message: "tap me" });
        const [toast] = useToastStore.getState().toasts;

        useToastStore.getState().removeToast(toast!.id);
        expect(useToastStore.getState().toasts).toHaveLength(0);

        // The timer still fires afterwards, and must not throw or resurrect it.
        vi.advanceTimersByTime(TOAST_DURATION_MS);
        expect(useToastStore.getState().toasts).toHaveLength(0);
    });
});
