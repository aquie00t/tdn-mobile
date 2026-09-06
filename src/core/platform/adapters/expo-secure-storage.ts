import * as SecureStore from "expo-secure-store";

import type { SecureStoragePort } from "../secure-storage.port";

/**
 * Backed by the Android keystore. Keys are limited to alphanumerics, `.`, `-`
 * and `_`, which is why `SecureKeys` uses dots rather than the colons the web
 * client's storage keys used.
 */
export const expoSecureStorage: SecureStoragePort = {
    get: (key) => SecureStore.getItemAsync(key),
    set: (key, value) => SecureStore.setItemAsync(key, value),
    remove: (key) => SecureStore.deleteItemAsync(key),
};
