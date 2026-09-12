import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@core/platform/zustand-storage";

/** Named for the same reason the other persisted keys are: so a migration can find it. */
export const PUSH_PROMPT_STORAGE_KEY = "tdn-push-prompt";

interface PushPromptState {
    dismissed: boolean;
    dismiss: () => void;
}

/**
 * Whether the reader has already said no to being asked.
 *
 * Persisted, and this is the only reason the store exists. Android remembers a
 * *refusal of the dialog* — `canAskAgain` goes false and the dialog never
 * appears again — but it remembers nothing about somebody tapping "not now"
 * before the dialog was ever shown. Held in memory only, that tap would be
 * forgotten at the next launch and the card would be back on the screen it was
 * just dismissed from, which is the behaviour people mean by nagging.
 *
 * One way, deliberately: there is no `restore`. Somebody who wants
 * notifications after saying no goes through the OS settings, which is also
 * the only route left once Android has taken the dialog away — so a second
 * in-app switch would promise something it cannot always deliver.
 */
export const usePushPromptStore = create<PushPromptState>()(
    persist(
        (set) => ({
            dismissed: false,
            dismiss: () => set({ dismissed: true }),
        }),
        {
            name: PUSH_PROMPT_STORAGE_KEY,
            storage: createJSONStorage(() => zustandStorage()),
        },
    ),
);
