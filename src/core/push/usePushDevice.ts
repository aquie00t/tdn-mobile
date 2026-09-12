import { useEffect } from "react";

import { deviceDescriptor } from "./device-descriptor";
import { syncDevice } from "./device-registration";
import { useLanguageStore } from "@shared/store/language.store";
import { useSessionStore } from "@core/session/session.store";

/**
 * Registers this phone for push, at every launch and whenever the language
 * changes.
 *
 * Mounted beside the socket in the root layout rather than on the
 * notifications tab: registration belongs to the session, and a tab that has
 * never been opened is the common case.
 *
 * **Every launch is the contract, not an optimisation.** The platform can
 * reissue a token at any time, and the API's retention sweep reads the last
 * registration as its freshness signal — a phone that stops re-registering is
 * dropped after 90 days as abandoned.
 *
 * The language is a dependency because the API writes the copy from it: the
 * *device's* language, chosen per registered device, is what a lock screen is
 * read in. The app's own setting is the closest thing to that and the one the
 * reader actually chose — the phone's OS locale would disagree with the app
 * they are looking at, and the profile's feed languages answer an unrelated
 * question about what belongs in a timeline.
 *
 * Sign-out is not here. Retiring the token has to happen *before* the session
 * is discarded, while it still authenticates the request, and that sequence
 * belongs to whoever signs out — `useAuthActions` calls `retireDevice()`.
 */
export function usePushDevice(): void {
    const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
    const locale = useLanguageStore((s) => s.locale);

    useEffect(() => {
        if (!isAuthenticated) return;

        void syncDevice(deviceDescriptor(locale));
    }, [isAuthenticated, locale]);
}
