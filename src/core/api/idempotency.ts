import * as Crypto from "expo-crypto";

/**
 * A key for one user action.
 *
 * **The caller owns this, not the client.** A key exists so that a retry of an
 * action is answered from the first attempt rather than run again, and the
 * retry that matters most is the one a person makes — tapping "post" a second
 * time after the first attempt timed out. A key minted inside `apiClient` would
 * be fresh on every attempt, which is indistinguishable from having none.
 *
 * So a hook generates one when the action begins and holds it for as long as
 * that action is being retried. A new action means a new key. The transport's
 * own replay after a 401 carries the key it was given, because the retry
 * spreads the same options.
 *
 * `crypto.randomUUID` does not exist in the React Native runtime; this is the
 * platform's implementation of the same V4 spec.
 *
 * Only eight routes accept a key — posts, both comment endpoints, articles,
 * messages, the two uploads and the Play purchase — and the plugin engages
 * only for an authenticated request. Sending one anywhere else is ignored, not
 * an error.
 */
export function newIdempotencyKey(): string {
    return Crypto.randomUUID();
}
