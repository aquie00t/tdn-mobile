import { create } from "zustand";

interface AuthFlowState {
    /**
     * What was typed on the first screen — an email or a username, not yet
     * known to be either.
     */
    identifier: string;
    /**
     * The email a reset code was sent to, carried from forgot-password to the
     * screen that spends it. `/auth/reset-password` takes the address as well
     * as the code, and asking for it twice invites a typo that fails as
     * "wrong code".
     */
    resetEmail: string;
    setIdentifier: (identifier: string) => void;
    setResetEmail: (email: string) => void;
    reset: () => void;
}

/**
 * The only state the sign-in flow carries between its screens.
 *
 * The web runs the whole flow from a store — a `step` field, a modal, and a
 * transition table. Here the steps are routes, so navigation *is* the state
 * machine and this holds the two strings a route parameter would otherwise
 * have to carry. Not persisted: a half-finished sign-in should not survive the
 * app being closed.
 */
export const useAuthFlowStore = create<AuthFlowState>((set) => ({
    identifier: "",
    resetEmail: "",
    setIdentifier: (identifier) => set({ identifier }),
    setResetEmail: (resetEmail) => set({ resetEmail }),
    reset: () => set({ identifier: "", resetEmail: "" }),
}));
