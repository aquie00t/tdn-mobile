import { api } from "@core/api/client";
import type { ClientMeta } from "./client-meta.types";

export const clientMetaApi = {
    /**
     * Asks whether this build is still supported.
     *
     * **`isAnonymous`, not `isPublic`**, and the flag's name undersells the
     * reason. `isAnonymous` exists for endpoints called to *obtain* a session;
     * what it does is send no token and hand a 401 straight back with no
     * replay and no refresh, and that is exactly what a launch check needs.
     * The endpoint authenticates nobody, so a token would buy nothing — while
     * `isPublic` would replay a 401 anonymously and refresh in the background,
     * which is a way to report a session as expired during boot over a call
     * that has nothing to do with the session.
     *
     * The build is **omitted** rather than sent as a nought when this binary
     * carries none. The API answers `updateRequired: false` to a client that
     * did not say which build it is; sending a nought would instead compare
     * nought against the floor and lock the app out of itself.
     *
     * @param build - This binary's build number, if it has one
     */
    getClientMeta: (build?: number): Promise<ClientMeta> => {
        const query =
            build === undefined
                ? ""
                : `?${new URLSearchParams({ build: String(build) }).toString()}`;

        return api.get<ClientMeta>(`/meta/client${query}`, {
            isAnonymous: true,
        });
    },
};
