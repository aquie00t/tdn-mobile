import { expoSecureStorage } from "../platform/adapters/expo-secure-storage";
import { SecureKeys } from "../platform/secure-storage.port";

/**
 * The two tokens, and nothing else. Who is signed in — the user, the
 * `isAuthenticated` flag — belongs to the session store, which is a separate
 * concern and a later PR.
 *
 * The access token is mirrored in memory because `apiClient` reads it on every
 * request. `expo-secure-store` does offer a synchronous `getItem`, so a read
 * per request would work, but it is a keystore round trip on the hot path for
 * a value that changes twice an hour. The mirror also keeps the ported client
 * identical to the web one rather than merely similar.
 *
 * The refresh token is not mirrored. It is read once per refresh, at most
 * every fifteen minutes, and keeping the more dangerous of the two out of a
 * module-level variable costs nothing.
 */
let accessToken: string | null = null;

/**
 * The access token for the next request, or `null`.
 *
 * Returns `null` until {@link loadTokens} has resolved, so a request made
 * before then is sent unauthenticated. The root layout waits for it before
 * rendering anything that fetches.
 */
export function getAccessToken(): string | null {
    return accessToken;
}

/** Seeds the mirror from the keystore. Called once, at boot. */
export async function loadTokens(): Promise<void> {
    accessToken = await expoSecureStorage.get(SecureKeys.accessToken);
}

export function getRefreshToken(): Promise<string | null> {
    return expoSecureStorage.get(SecureKeys.refreshToken);
}

/**
 * Stores a freshly issued pair.
 *
 * `refreshToken` is optional because only the body channel carries one, and a
 * response that omits it must leave the stored token alone rather than erase
 * it — clearing it here would sign the account out at the next refresh.
 */
export async function setTokens(tokens: {
    accessToken: string;
    refreshToken?: string;
}): Promise<void> {
    accessToken = tokens.accessToken;
    await expoSecureStorage.set(SecureKeys.accessToken, tokens.accessToken);

    if (tokens.refreshToken) {
        await expoSecureStorage.set(
            SecureKeys.refreshToken,
            tokens.refreshToken,
        );
    }
}

export async function clearTokens(): Promise<void> {
    accessToken = null;
    await expoSecureStorage.remove(SecureKeys.accessToken);
    await expoSecureStorage.remove(SecureKeys.refreshToken);
}
