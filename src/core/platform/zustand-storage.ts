import { asyncStorage } from "./adapters/async-storage";
import type { StoragePort } from "./storage.port";

/**
 * Zustand's `persist` middleware, wired to the app's storage port.
 *
 * On the web `persist` needs no configuration: it reaches for `localStorage`,
 * which exists and is synchronous. Neither is true here, so every persisted
 * store has to be handed a storage explicitly, and this is the one they share.
 *
 * The two interfaces disagree only about names — `StoragePort` says
 * `get`/`set`/`remove`, zustand says `getItem`/`setItem`/`removeItem` — so this
 * is a rename and nothing more.
 *
 * It imports the adapter directly rather than the `platform` barrel, which
 * also pulls in `react-native` and NetInfo. One import of the barrel would put
 * three native modules in the way of every test whose module graph reaches a
 * persisted store, which is most of them. `core/session/tokens.ts` reaches
 * `expo-secure-store` the same way and for the same reason.
 */
export function zustandStorage(storage: StoragePort = asyncStorage) {
    return {
        getItem: (name: string) => storage.get(name),
        setItem: (name: string, value: string) => storage.set(name, value),
        removeItem: (name: string) => storage.remove(name),
    };
}
