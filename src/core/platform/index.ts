import { isRunningInExpoGo } from "expo";

import { asyncStorage } from "./adapters/async-storage";
import { expoSecureStorage } from "./adapters/expo-secure-storage";
import { netInfoNetwork } from "./adapters/netinfo-network";
import { rnAppState } from "./adapters/rn-app-state";
import { unavailablePush } from "./adapters/unavailable-push";

import type { AppStatePort } from "./app-state.port";
import type { NetworkPort } from "./network.port";
import type { PushPort } from "./push.port";
import type { SecureStoragePort } from "./secure-storage.port";
import type { StoragePort } from "./storage.port";

/**
 * Every platform capability the app depends on, in one object.
 *
 * This is the whole of the dependency injection here. The API repo needs an
 * awilix container because it wires dozens of classes together at boot; a
 * React app does not — a module import *is* the injection, and a container
 * would cost bundle size, break tree-shaking and fight Fast Refresh for
 * nothing.
 *
 * What is worth keeping from that pattern is the seam, and this is it: one
 * place where the ports meet their adapters, so a test substitutes an object
 * rather than mocking four native modules, and so the iOS work is adapters
 * beside these rather than edits scattered through features.
 */
export interface Platform {
    secureStorage: SecureStoragePort;
    storage: StoragePort;
    appState: AppStatePort;
    network: NetworkPort;
    push: PushPort;
}

/**
 * The real adapter, required rather than imported — and only outside Expo Go.
 *
 * An `import` is hoisted and evaluated whatever the branch below decides, and
 * evaluating `expo-notifications` in Expo Go on Android throws (see
 * `unavailable-push.ts`). A `require` inside the branch is the one form Metro
 * leaves unevaluated until it is reached. `isRunningInExpoGo` is the check the
 * library itself makes before throwing, so the two cannot disagree.
 *
 * It also stubs push in Expo Go on iOS, where the library only warns. That is
 * moot while the app is Android-only; when iOS lands, narrowing this to
 * Android keeps push working there.
 */
function pushAdapter(): PushPort {
    if (isRunningInExpoGo()) return unavailablePush;

    const { expoPush } =
        require("./adapters/expo-push") as typeof import("./adapters/expo-push");

    return expoPush;
}

export const platform: Platform = {
    secureStorage: expoSecureStorage,
    storage: asyncStorage,
    appState: rnAppState,
    network: netInfoNetwork,
    push: pushAdapter(),
};
