import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "../platform/zustand-storage";

export interface SessionUser {
    id: string;
    username: string;
    isEmailVerified: boolean;
    /** Filled from the profile once that feature exists. */
    fullName?: string;
    avatarUrl?: string;
}

export const SESSION_STORAGE_KEY = "tdn-session";

interface SessionState {
    user: SessionUser | null;
    isAuthenticated: boolean;
    setSession: (user: SessionUser) => void;
    updateUser: (details: Partial<SessionUser>) => void;
    clearSession: () => void;
}

/**
 * Who is signed in. The tokens are `tokens.ts`'s job and are deliberately not
 * here: this is display data, persisted in ordinary storage, while a token
 * belongs in the keystore.
 *
 * There is no `signOut` on the store, and that is not an oversight. Signing out
 * means telling the server, which means an API call, which means importing a
 * feature's data layer — and `core/` may not import `features/`. The feature
 * owns the sequence; the store owns the state, and `clearSession` is the part
 * of it that belongs here.
 */
export const useSessionStore = create<SessionState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,

            setSession: (user) => set({ user, isAuthenticated: true }),

            updateUser: (details) =>
                set((state) => ({
                    user: state.user ? { ...state.user, ...details } : null,
                })),

            clearSession: () => set({ user: null, isAuthenticated: false }),
        }),
        {
            name: SESSION_STORAGE_KEY,
            storage: createJSONStorage(() => zustandStorage()),
        },
    ),
);
