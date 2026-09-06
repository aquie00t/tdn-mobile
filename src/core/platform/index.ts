import { asyncStorage } from "./adapters/async-storage";
import { expoSecureStorage } from "./adapters/expo-secure-storage";
import { netInfoNetwork } from "./adapters/netinfo-network";
import { rnAppState } from "./adapters/rn-app-state";

import type { AppStatePort } from "./app-state.port";
import type { NetworkPort } from "./network.port";
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
}

export const platform: Platform = {
    secureStorage: expoSecureStorage,
    storage: asyncStorage,
    appState: rnAppState,
    network: netInfoNetwork,
};
