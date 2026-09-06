/**
 * Ordinary persistence: the theme choice, the language, which accounts have
 * finished onboarding. Everything a browser would have put in `localStorage`.
 *
 * Deliberately separate from `SecureStoragePort`. The keystore is slow and
 * finite, and putting a UI preference in it competes with the thing that
 * actually needs protecting. Nothing here is a credential.
 */
export interface StoragePort {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
}
