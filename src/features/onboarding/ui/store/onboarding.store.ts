import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CategoryValue } from "@shared/constants/categories";
import { zustandStorage } from "@core/platform/zustand-storage";

/** Named like the other persisted keys, so a migration can find it. */
export const ONBOARDING_STORAGE_KEY = "tdn-onboarding";

interface OnboardingState {
    /**
     * Kept per user id rather than as a single boolean: a phone that two
     * accounts sign into would otherwise let the second one skip the flow on
     * the strength of the first having finished it.
     */
    completedUserIds: string[];
    /**
     * The fields picked in step one. The API has nowhere to put these — a
     * profile carries no interests, and `/profiles/bots` only takes them as a
     * query parameter — so this store is the only record they have.
     */
    interests: CategoryValue[];

    setInterests: (interests: CategoryValue[]) => void;
    complete: (userId: string, interests: CategoryValue[]) => void;
}

export const useOnboardingStore = create<OnboardingState>()(
    persist(
        (set) => ({
            completedUserIds: [],
            interests: [],

            // Written as the picker is used rather than at the end, so
            // stepping back to step one comes back to the fields already
            // chosen instead of an empty picker.
            setInterests: (interests) => set({ interests }),

            complete: (userId, interests) =>
                set((state) => ({
                    completedUserIds: state.completedUserIds.includes(userId)
                        ? state.completedUserIds
                        : [...state.completedUserIds, userId],
                    /*
                     * An empty pick means the *gate* marked this done off the
                     * server's follow count, not a trip through the picker.
                     * Writing it through would wipe fields chosen earlier, on
                     * a path that never asked about them.
                     */
                    interests:
                        interests.length > 0 ? interests : state.interests,
                })),
        }),
        {
            name: ONBOARDING_STORAGE_KEY,
            storage: createJSONStorage(() => zustandStorage()),
        },
    ),
);
