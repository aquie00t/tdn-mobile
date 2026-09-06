import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

import type { NetworkPort } from "../network.port";

/**
 * `isInternetReachable` is `null` until the first reachability probe answers,
 * and treating unknown as offline would pause the socket on every cold start —
 * exactly when it most needs to dial. So unknown counts as online and only an
 * explicit `false` counts as not.
 */
const isReachable = (state: NetInfoState): boolean =>
    state.isConnected === true && state.isInternetReachable !== false;

/**
 * The last state an event reported. NetInfo emits once immediately on
 * subscribe, so this is live for anything that has subscribed — which the
 * socket does at mount. Before that it is an optimistic default, which is the
 * right way round: a request that fails is recoverable, a request never sent
 * because the app guessed offline is not.
 */
let lastKnownOnline = true;

export const netInfoNetwork: NetworkPort = {
    isOnline: () => lastKnownOnline,

    subscribe: (listener) =>
        NetInfo.addEventListener((state) => {
            const online = isReachable(state);
            if (online === lastKnownOnline) return;
            lastKnownOnline = online;
            listener(online);
        }),
};
