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
    /**
     * The token that recovers a deleted account, carried from wherever it was
     * handed over to the screen that spends it — a 403 from `/auth/login`, or
     * an OAuth callback that came back `account_pending_deletion`.
     *
     * It is a credential with a fifteen-minute life, which is the other reason
     * this store is not persisted: it has no business surviving the app being
     * closed, and `reset()` below is what discards it once it is spent.
     */
    recoveryToken: string;
    setIdentifier: (identifier: string) => void;
    setResetEmail: (email: string) => void;
    setRecoveryToken: (token: string) => void;
    reset: () => void;
}

/**
 * The only state the sign-in flow carries between its screens.
 *
 * The web runs the whole flow from a store — a `step` field, a modal, and a
 * transition table. Here the steps are routes, so navigation *is* the state
 * machine and this holds the three strings a route parameter would otherwise
 * have to carry. Not persisted: a half-finished sign-in should not survive the
 * app being closed.
 */
export const useAuthFlowStore = create<AuthFlowState>((set) => ({
    identifier: "",
    resetEmail: "",
    recoveryToken: "",
    setIdentifier: (identifier) => set({ identifier }),
    setResetEmail: (resetEmail) => set({ resetEmail }),
    setRecoveryToken: (recoveryToken) => set({ recoveryToken }),
    reset: () => set({ identifier: "", resetEmail: "", recoveryToken: "" }),
}));
