/**
 * Where the session lives.
 *
 * On the web the refresh token was an httpOnly cookie that page JavaScript
 * could not read, and that was the whole of its protection. A native client
 * has no such thing: the API hands it the refresh token in the response body
 * (`client: "native"` on login), so the app owns the token outright and the
 * platform keystore is what replaces the cookie.
 *
 * A port rather than a direct `expo-secure-store` call because this is the one
 * dependency a test must never reach — the keystore is unavailable off-device,
 * and a test that silently fell back to plain storage would be asserting
 * against something the app never does.
 */
export interface SecureStoragePort {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
}

/** The keys, named once so a rename cannot half-happen. */
export const SecureKeys = {
    accessToken: "tdn.access_token",
    refreshToken: "tdn.refresh_token",
} as const;
