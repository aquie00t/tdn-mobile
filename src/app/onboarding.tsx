import { OnboardingScreen } from "@features/onboarding/ui/screens/OnboardingScreen";
import { Screen } from "@shared/ui/Screen";
import { Spinner } from "@shared/ui/Spinner";
import { router } from "expo-router";
import { useFollowingCount } from "@features/profile/ui/hooks/useFollowingCount";
import { useOnboardingStore } from "@features/onboarding/ui/store/onboarding.store";
import { useSessionStore } from "@core/session/session.store";

/**
 * Where the two features meet.
 *
 * The flow needs a number that belongs to the profile feature —
 * `followingCount`, which decides how many more accounts to ask for — and a
 * feature may not reach into another. A route may reach into both, and that is
 * what this file is for.
 *
 * The count is waited for rather than defaulted. Rendering step one at nought
 * is harmless, but stepping straight through to a heading that asks for five
 * and then correcting itself to two is not, and the request is one round trip
 * against a screen somebody is about to read for a while.
 */
export default function OnboardingRoute() {
    const { count, isLoading } = useFollowingCount();

    const userId = useSessionStore((s) => s.user?.id);
    const complete = useOnboardingStore((s) => s.complete);

    if (isLoading) {
        return (
            <Screen>
                <Spinner center />
            </Screen>
        );
    }

    return (
        <OnboardingScreen
            alreadyFollowing={count}
            onFinish={(interests) => {
                /*
                 * Recorded before navigating, not after. The gate watches this
                 * list, so an account sent to the feed while it still reads as
                 * unfinished is an account the gate turns around at the door.
                 */
                if (userId) complete(userId, interests);
                router.replace("/");
            }}
        />
    );
}
