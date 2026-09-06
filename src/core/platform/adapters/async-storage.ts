import AsyncStorage from "@react-native-async-storage/async-storage";

import type { StoragePort } from "../storage.port";

export const asyncStorage: StoragePort = {
    get: (key) => AsyncStorage.getItem(key),
    set: (key, value) => AsyncStorage.setItem(key, value),
    remove: (key) => AsyncStorage.removeItem(key),
};
