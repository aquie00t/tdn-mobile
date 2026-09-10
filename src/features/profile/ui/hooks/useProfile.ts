import { useCallback, useRef, useState } from "react";

import { getErrorMessage } from "@shared/utils/error-handler";
import type { Profile } from "../../data/profile.types";
import { profileApi } from "../../data/profile.api";

interface ProfileState {
    profile: Profile | null;
    /** Whose profile the state currently holds. */
    fetchedUsername: string | null;
    error: string | null;
}

/**
 * One profile, by username.
 *
 * **Loading is derived, not raised.** `isLoading` is "the username I hold is
 * not the one I was asked for", which is what stops a stale profile being
 * shown for a frame when the screen moves to another account — a boolean flag
 * has to be set, and between the ask and the setting there is one render still
 * holding somebody else's name and face.
 *
 * The screen calls `fetchProfile`, as it does on `useFeed` and `useComments`.
 * A request stamped older than the newest one is dropped rather than written,
 * which is the same guard the feed uses for a fast tab switch: here it is a
 * fast move between two profiles.
 */
export function useProfile(username: string) {
    const [state, setState] = useState<ProfileState>({
        profile: null,
        fetchedUsername: null,
        error: null,
    });
    const requestRef = useRef(0);

    const isLoading = state.fetchedUsername !== username;

    const fetchProfile = useCallback(async () => {
        const requestId = ++requestRef.current;

        try {
            const profile = await profileApi.getProfile(username);
            if (requestId !== requestRef.current) return;
            setState({ profile, fetchedUsername: username, error: null });
        } catch (err) {
            if (requestId !== requestRef.current) return;
            setState({
                profile: null,
                fetchedUsername: username,
                error: getErrorMessage(err),
            });
        }
    }, [username]);

    /**
     * Puts the screen back into loading rather than leaving the stale error
     * under a spinner — clearing the fetched username is what does it, since
     * that is what loading is derived from.
     */
    const retry = useCallback(() => {
        setState({ profile: null, fetchedUsername: null, error: null });
        void fetchProfile();
    }, [fetchProfile]);

    /**
     * Applied when something on the screen changes the profile — following
     * moves `followersCount`, and the header has to agree with the button.
     */
    const patch = useCallback((changes: Partial<Profile>) => {
        setState((prev) =>
            prev.profile
                ? { ...prev, profile: { ...prev.profile, ...changes } }
                : prev,
        );
    }, []);

    return {
        profile: isLoading ? null : state.profile,
        isLoading,
        error: state.error,
        fetchProfile,
        retry,
        patch,
    };
}
