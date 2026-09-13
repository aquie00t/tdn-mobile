import { useCallback, useRef, useState } from "react";

import { getErrorMessage } from "@shared/utils/error-handler";
import type { AccountInfo } from "../../data/settings.types";
import { settingsApi } from "../../data/settings.api";

interface AccountInfoState {
    account: AccountInfo | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * The account, read when Settings opens.
 *
 * The screen calls `load`, as it calls `fetchProfile` on the profile and
 * `fetchFeed` on the feed. A retry that overlaps a slow first read is resolved
 * by the request id, the same guard those use: the older answer is dropped.
 *
 * `patch` is how the forms keep it honest. Each change answers 204 with
 * nothing in it, so rather than reading the account again after every save,
 * the form that made a change applies it here — which is also how a changed
 * email brings the verification section up without a round trip.
 */
export function useAccountInfo() {
    const [state, setState] = useState<AccountInfoState>({
        account: null,
        isLoading: true,
        error: null,
    });
    const requestRef = useRef(0);

    const load = useCallback(async () => {
        const requestId = ++requestRef.current;

        try {
            const account = await settingsApi.getAccountInfo();
            if (requestId !== requestRef.current) return;
            setState({ account, isLoading: false, error: null });
        } catch (err) {
            if (requestId !== requestRef.current) return;
            setState({
                account: null,
                isLoading: false,
                error: getErrorMessage(err),
            });
        }
    }, []);

    const retry = useCallback(() => {
        setState({ account: null, isLoading: true, error: null });
        void load();
    }, [load]);

    const patch = useCallback((changes: Partial<AccountInfo>) => {
        setState((prev) =>
            prev.account
                ? { ...prev, account: { ...prev.account, ...changes } }
                : prev,
        );
    }, []);

    return { ...state, load, retry, patch };
}
