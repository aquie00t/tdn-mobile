import { AppState } from "react-native";

import type { AppStatePort } from "../app-state.port";

export const rnAppState: AppStatePort = {
    isForeground: () => AppState.currentState === "active",

    subscribe: (listener) => {
        const subscription = AppState.addEventListener("change", (state) => {
            // "inactive" is the transitional state a phone passes through
            // while the app switcher is open or a call is arriving. Reporting
            // it as backgrounded tears the socket down for a notification
            // shade being pulled, so only "active" counts as foreground and
            // everything else as away.
            listener(state === "active");
        });

        return () => subscription.remove();
    },
};
