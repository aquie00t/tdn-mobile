import * as Crypto from "expo-crypto";
import { create } from "zustand";

export type ToastType = "error" | "success" | "info";

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
}

/** Long enough to read a sentence, short enough not to sit over the screen. */
export const TOAST_DURATION_MS = 4000;

interface ToastState {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
}

/**
 * Not persisted — a toast that survived a restart would be reporting something
 * that happened in a session the reader has already left.
 *
 * Ids come from `expo-crypto`: `crypto.randomUUID` does not exist in this
 * runtime, and an incrementing counter would collide across a fast-refresh.
 */
export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    addToast: (toast) => {
        const id = Crypto.randomUUID();
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

        // The timer belongs to the store rather than to the component, so a
        // toast dismisses itself whether or not anything is rendering it —
        // otherwise a screen unmounting mid-toast would strand the row.
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id),
            }));
        }, TOAST_DURATION_MS);
    },

    removeToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
