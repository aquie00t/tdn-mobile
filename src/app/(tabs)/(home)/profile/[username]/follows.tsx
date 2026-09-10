import { useLocalSearchParams } from "expo-router";

import type { FollowListType } from "@features/profile/data/profile.types";
import { FollowListScreen } from "@features/profile/ui/screens/FollowListScreen";

/**
 * Followers or following, chosen by a query parameter rather than by two
 * routes: the screen is identical either way, and two files would be one file
 * and a copy of its header.
 */
export default function FollowsRoute() {
    const { username, type } = useLocalSearchParams<{
        username: string;
        type?: string;
    }>();

    return (
        <FollowListScreen
            username={username}
            type={
                (type === "following"
                    ? "following"
                    : "followers") as FollowListType
            }
        />
    );
}
